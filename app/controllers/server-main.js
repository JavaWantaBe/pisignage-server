'use strict';

const mongoose = require('mongoose'),
      Player = mongoose.model('Player'),
      Asset = mongoose.model('Asset'),
      rest = require('../others/restware'),
      config = require('../../config/config'),
      fs = require('fs'),
      async = require('async'),
      logger = require('node-logger').createLogger(),
      path = require('path');

const oldSocketio = require('./server-socket'),
      newSocketio = require('./server-socket-new');

let playersToBeSynced = {}, players = {};

exports.getStatus = function (req, res) {
    return rest.sendSuccess(res, 'Dummy status', {server: true});
};

exports.getSettings = function () {
};

exports.saveSettings = function () {
};

exports.deploy = function (installation,group, cb) {
    async.series([
        function (async_cb) {

            if (!group.playlists  || group.playlists.length === 0)
                return async_cb("No Playlists assigned to the Group");

            Player.find({'group._id': group._id}, function (err, data) {
                if (err || !data || data.length === 0) {
                    logger.error("unable to get Players list for deploy:"  + err);
                    async_cb("No Players associated, "+(err?err:""));
                } else {
                    data.forEach(function (player) {
                        playersToBeSynced[player.cpuSerialNumber] = player;
                    });
                    players[group._id.toString()] = data;
                    async_cb();
                }
            });
        },
        function (async_cb) {
            const syncPath = path.join(config.syncDir, installation, group.name),
                  mediaPath = path.join(config.mediaDir);

            fs.mkdir(syncPath, function (err) {
                let filesNotPresent = [];

                logger.info("created directory: " + syncPath);

                async.eachSeries(group.assets, function (file, iterative_cb) {
                        const srcfile = path.join(mediaPath,file),
                              dstfile = path.join(syncPath,file);
                        fs.unlink(dstfile, function (err) {
                            fs.stat(srcfile, function (err, stats) {
                                if (err || !stats.isFile()) {
                                    if (file.indexOf("TV_OFF") === -1) {
                                        logger.error("removing file as it is not present: " + file);
                                        //group.assets.splice(group.assets.indexOf(file), 1)       //careful, async gets affected if the array is same
                                        filesNotPresent.push(file);
                                    }
                                    iterative_cb();
                                } else if (file.match(/^__.*\.json$/)) {
                                    //copy the playlist files instead of symlink
                                    let cbCalled = false,
                                        done = function(err) {
                                            if (!cbCalled) {
                                                if (err) {
                                                    console.log(err);
                                                    let errMessage = "Unable to copy playlist " + file + " for " + installation;
                                                    logger.error(errMessage );
                                                    iterative_cb(errMessage);
                                                } else
                                                    iterative_cb();
                                                cbCalled = true;
                                            }
                                        };

                                    let rd = fs.createReadStream(srcfile);
                                    rd.on("error", (err) => {
                                        done(err);
                                    });

                                    let wr = fs.createWriteStream(dstfile);
                                    wr.on("error", (err) => {
                                        done(err);
                                    });

                                    wr.on("close", (ex) => {
                                        done();
                                    });

                                    rd.pipe(wr);
                                } else {
                                    logger.info("file is present; " + file);

                                    fs.symlink(srcfile, dstfile, (err) => {
                                        if (err && (err.code !== 'ENOENT')) {
                                            iterative_cb();
                                        } else {
                                            iterative_cb();
                                        }
                                    });
                                }
                            });
                        });
                    },
                    function (err, result) {
                        filesNotPresent.forEach((file) =>{
                            group.assets.splice(group.assets.indexOf(file), 1);
                        });
                        async_cb(err);
                    }
                );
            });
        },
        function (async_cb) {
            let syncPath = path.join(config.syncDir, installation, group.name);

            fs.readdir(syncPath, (err, data) => {
                if (err)
                    async_cb(err);
                else {
                    let files = data.filter((file) => {
                        return (file.charAt(0) !== '.');
                    });
                    async.eachSeries(files,
                        function (file, iterative_cb) {
                            if (group.assets.indexOf(file) === -1) {
                                fs.unlink(path.join(syncPath, file), (err) => {
                                    iterative_cb();
                                });
                            } else {
                                iterative_cb();
                            }
                        },
                        function (err, result) {
                            async_cb(err);
                        }
                    );
                }
            });
        },
        function(async_cb){ // brand video check
            let specialFiles = ["brand_intro.mp4","brand_intro_portrait.mp4","welcome.ejs","iot.zip"];
            let filesAdded = [];

            async.eachSeries(specialFiles,
                function(file,iterative_cb){
                    const syncPath = path.join(config.syncDir, installation, group.name, file),
                          mediaPath = path.join(config.mediaDir, file);
                    fs.unlink(syncPath, (err) => {
                        fs.stat(mediaPath, (err, stats) => {
                            if (err || !stats.isFile())
                                iterative_cb();
                            else {
                                fs.symlink(mediaPath, syncPath, (err) => {
                                    if (err && (err.code !== 'ENOENT')) {
                                        logger.error('error in creating symlink to ' + file);
                                    }
                                    filesAdded.push(file);
                                    iterative_cb();
                                });
                            }
                        });
                    });
                },
                function(err,result){
                    group.assets = group.assets.concat(filesAdded);
                    async_cb(err);
                }
            );
        },
        function(async_cb){ // send list of asset validity
            Asset.find({'validity.enable':true,'name':{'$in':group.assets}},
                "name validity", (err, data) => {
                    if (!err && data) {
                        group.assetsValidity = data.map((asset) => {
                            return ({name:asset.name, startdate:asset.validity.startdate, enddate:asset.validity.enddate});
                        });
                        logger.info(group.assetsValidity);
                    } else {
                        group.assetsValidity = [];
                        logger.error("asset validity query error for " + installation + ";" + err);
                    }
                    async_cb();
                });
        }], function (err, results) {
            group.deployedAssets = group.assets;
            group.deployedPlaylists = group.playlists;
            group.deployedTicker = group.ticker;

            if (err) {
                logger.error("in deploy: ", err);
                return cb(err, group);
            }
            players[group._id.toString()].forEach(function (player) {
                let socketio = (player.newSocketIo?newSocketio:oldSocketio);
                socketio.emitMessage(player.socket, 'sync',
                    group.playlists, group.assets, group.deployedTicker,
                    group.logo, group.logox, group.logoy,group.combineDefaultPlaylist,group.omxVolume,
                    group.loadPlaylistOnCompletion, group.assetsValidity);
            });
            logger.info("sending sync event to players");
            cb(null, group);
        }
    );
};
