'use strict';

const fs = require('fs'),
      path = require('path'),
      async = require('async'),
      _ = require('lodash'),
      logger = require('node-logger').createLogger(),
      fileUtil = require('../others/file-util');

const mongoose = require('mongoose'),
      Asset = mongoose.model('Asset'),
      config = require('../../config/config'),
      rest = require('../others/restware');

/**
 *
 * @param req
 * @param res
 */
exports.index = function (req, res) {
    let files, dbdata;

    async.series([
        function(next) {
            fs.readdir(config.mediaDir, function (err, data) {
                if (err) {
                    next("Error reading media directory: " + err);
                } else {
                    files = data.filter((file) => {
                        return (file.charAt(0) !== '_' && file.charAt(0) !== '.');
                    });
                    next();
                }
            });
        },
        function(next)  {
            Asset.find({}, function (err, data) {
                if (err) {
                    logger.error("error reading asset collection: " + err);
                } else {
                    dbdata = data;
                }
                next();
            });
        }
    ], function(err) {
        if (err)
            rest.sendError(res,err);
        else
            rest.sendSuccess(res, "Sending media directory files: ",
                {files: files, dbdata: dbdata, systemAssets: config.systemAssets});
    });
};

/**
 *
 * @param req
 * @param res
 * @returns {*}
 */
exports.createFiles = function (req, res) {
    let files = [],
        data = [];

    if (req.files)
        files = req.files.assets;
    else
        return rest.sendError(res, "There are no files to be uploaded");

    function renameFile(fileObj, next) {
        let filename = fileObj.originalname.replace(config.filenameRegex, '');

        logger.info("uploaded file: " + fileObj.path);

        if ((filename).match(config.zipfileRegex)) //unzip won't work with spaces in file name
            filename = filename.replace(/ /g,'');

        if(filename.match(config.brandRegex)) // change brand video name
            filename = filename.toLowerCase();

        fs.rename(fileObj.path, path.join(config.mediaDir, filename), function (err) {
            if (err) {
                next(err);
            } else {
                if((filename).match(/^custom_layout.*html$/i)){
                    fileUtil.modifyHTML(config.mediaDir,filename);
                }
                data.push({
                    name: filename,
                    size: fileObj.size,
                    type: fileObj.mimetype
                });
                next();
            }
        });
    }

    async.each(files, renameFile, function (err) {
        if (err) {
            let msg = "File rename error after upload: " + err;
            logger.error(msg);
            return rest.sendError(res, msg);
        } else {
            return rest.sendSuccess(res, ' Successfully uploaded files', data);
        }
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.updateFileDetails = function (req, res) {
    require('./server-assets').storeDetails(req, res);
};

/**
 *
 * @param req
 * @param res
 */
exports.getFileDetails = function (req, res) {
    let file = req.params.file,
        fileData,
        dbData;

    async.series([
        function(next) {
            fs.stat(path.join(config.mediaDir, file), function (err, data) {
                if (err) {
                    next('Unable to read file details: '+ err);
                } else {
                    fileData = data;
                    if (file.match(config.imageRegex))
                        fileData.type = 'image';
                    else if (file.match(config.videoRegex))
                        fileData.type = 'video';
                    else if (file.match(config.audioRegex))
                        fileData.type = 'audio';
                    else if (file.match(config.htmlRegex))
                        fileData.type = 'html';
                    else if (file.match(config.liveStreamRegex) || file.match(config.omxStreamRegex) || file.match(config.mediaRss) || file.match(config.CORSLink) || file.match(config.linkUrlRegex))
                        fileData.type = 'link';
                    else if (file.match(config.gcalRegex))
                        fileData.type = 'gcal';
                    else if (file.match(config.pdffileRegex))
                        fileData.type = 'pdf';
                    else if (file.match(config.txtFileRegex))
                        fileData.type = 'text';
                    else if (file.match(config.radioFileRegex))
                        fileData.type = 'radio';
                    else
                        fileData.type = 'other';
                    next();
                }
            });
        },
        function(next) {
            Asset.findOne({name: file}, function (err, data) {
                if (err) {
                    logger.error("error reading asset collection: " + err);
                } else {
                    dbData = data;
                }
                next();
            });
        }
    ],function(err){
        if (err)
            rest.sendError(res,err);
        else
            rest.sendSuccess(res, 'Sending file details',
            {
                name: file,
                size: Math.floor(fileData.size / 1000) + ' KB',
                ctime: fileData.ctime,
                path: '/media/' +  file,
                type: fileData.type,
                dbdata: dbData
            });
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.deleteFile = function (req, res) {

    let file = req.params.file,
        ext = path.extname(file);

    async.series([
        function(next) {
            fs.unlink(path.join(config.mediaDir, file), (err) => {
                if (err)
                    next("Unable to delete file " + file + ';' + err);
                else
                    next();
            });
        },
        function(next) {
            Asset.remove({name: file}, (err) => {
                if (err)
                    logger.error('unable to delete asset from db,' + file);
                next();
            });
        },
        function(next) {
            let thumbnailPath = path.join(config.thumbnailDir, file);

            if (file.match(config.videoRegex))
                thumbnailPath += '.png';
            if(file.match(config.videoRegex) || file.match(config.imageRegex)){
                fs.unlink(thumbnailPath, (err) => {
                    if (err)
                        logger.error('unable to find/delete thumbnail: ' + err);
                    next();
                });
            } else {
                next();
            }
        }
    ], function(err) {
        if (err)
            rest.sendError(res,err);
        else
            return rest.sendSuccess(res, 'Deleted file successfully', file);
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.updateAsset = function (req, res) {

    if (req.body.newname) {
        let oldName = req.params.file,
            newName = req.body.newname;

        async.series([
            function(next) {
                fs.rename(path.join(config.mediaDir, oldName), path.join(config.mediaDir, newName), (err) => {
                    if (err) {
                        next('file rename error: '+ err);
                    } else {
                        next();
                    }
                });
            },
            function(next) {
                Asset.findOne({name: oldName}, (err, asset) => {
                    if (err || !asset) {
                        logger.error('unable to find asset from db,' + oldName);
                        return next();
                    }
                    asset.name = newName;
                    asset.save((err) => {
                        if (err)
                            logger.error('unable to save asset after rename,' + oldName);
                        next();
                    });
                });
            }
        ], function(err) {
            if (err)
                rest.sendError(res,err);
            else
                return rest.sendSuccess(res, 'Successfully renamed file to', newName);
        });
    } else if (req.body.dbdata) {
        Asset.load(req.body.dbdata._id, (err, asset) => {
            if (err || !asset) {
                return rest.sendError(res, 'Categories saving error', err);
            } else {
                asset = _.extend(asset, req.body.dbdata);
                asset.save((err, data) => {
                    if (err)
                        return rest.sendError(res, 'Categories saving error', err);

                    return rest.sendSuccess(res, 'Categories saved', data);
                });
            }
        });
    }
};

exports.getCalendar = function (req, res) {
    let calFile = path.join(config.mediaDir, req.params.file);

    fs.readFile(calFile, 'utf8', (err, data) => {
        if (err || !data)
            return rest.sendError(res, 'Gcal file read error', err);

        let calData = JSON.parse(data);

        require('./gcal').index(calData, (err, list) => {
            if (err) {
                return rest.sendError(res, 'Gcal error', err);
            } else {
                return rest.sendSuccess(res, 'Sending calendar details',
                    {
                        profile: calData.profile,
                        list: _.map(list.items, (item) => {
                            return _.pick(item, 'summary', 'id');
                        }),
                        selected: _.find(list.items, {'id': calData.selectedEmail}).summary
                    }
                );
            }
        });
    });
};

/**
 *
 * @param name
 * @param data
 * @param cb
 */
exports.createAssetFileFromContent = function (name, data, cb) {
    let file = path.resolve(config.mediaDir, name);
    fs.writeFile(file, JSON.stringify(data, null, 4), cb);
};

/**
 *
 * @param req
 * @param res
 */
exports.updateCalendar = function (req, res) {
    let calFile = path.join(config.mediaDir,  req.params.file);

    fs.readFile(calFile, 'utf8', (err, data) => {
        if (err || !data)
            return rest.sendError(res, 'Gcal file read error', err);
        data = JSON.parse(data);
        data.selectedEmail = req.body.email;
        exports.createAssetFileFromContent(calFile, data, () => {
            if (err)
                return rest.sendError(res, 'Gcal file write error', err);
            else
                return rest.sendSuccess(res, 'Successfully updated Email');
        });
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.createLinkFile = function (req, res) {
    let details = req.body.details;

    async.series([
        function (next) {
            fs.writeFile(config.mediaPath + details.name + details.type,
                JSON.stringify(details, null, 4),
                'utf8',
                (err) => {
                next(err);
            });
        }, function(next) {
                require('./server-assets').storeLinkDetails(details.name+details.type,
                    'link',
                    req.body.categories,
                    next
                );
        }], function(err) {
                if (err)
                    return rest.sendError(res, 'error in creating link file', err);
                else
                    return rest.sendSuccess(res, 'Link file created for the link as ' + details.name + details.type);
        });
};

/**
 *
 * @param req
 * @param res
 */
exports.getLinkFileDetails = function (req, res) {
    let fileToRead = req.params.file;
    let retData = {};

    async.series([
        function (next) {
            fs.readFile(config.mediaPath + fileToRead, 'utf-8', (err, data) => {
                retData.data = data;
                next(err);
            });
        }, function (next) {
            Asset.findOne({name: fileToRead}, (err, dbdata) => {
                retData.dbdata = dbdata;
                next();
            });
    }], function (err) {
        if (err) {
            return rest.sendError(res, 'unable to read link file, error:' + err);
        } else {
            return rest.sendSuccess(res, 'link file details', retData);
        }
    });
};

/**
 *
 * @param req
 * @param res
 * @returns {*}
 */
exports.updatePlaylist = function (req,res) {
    //req.body contain playlist name and assets, for deleted playlist send playlist name and empty assets
    require('./server-assets').updatePlaylist(req.body.playlist, req.body.assets);
    return rest.sendSuccess(res, 'asset update has been queued');
};
