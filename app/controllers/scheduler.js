'use strict';

const scheduler = require('node-schedule');
let dayScheduler;

const http = require('http'),
      fs = require('fs'),
      path = require('path'),
      async = require('async'),
      config = require('../../config/config'),
      logger = require('node-logger').createLogger(),
      serverFile = path.join(config.releasesDir,"server-package.json"),
      packageJsonFile = path.join(config.releasesDir,"package.json");

/**
 *
 * @param url
 * @param dest
 * @param cb
 */
let download = function(url, dest, cb) {
    let file = fs.createWriteStream(dest);
    let request = http.get(url, (response) => {
        logger.info("downloading " + url);

        response.on('data', (data) => {
            process.stdout.write("#");
        }).pipe(file);

        file.on('finish', () => {
            logger.info("done");
            file.close(cb);  // close() is async, call cb after close completes.
        });
    }).on('error', (err) => { // Handle errors
        fs.unlink(dest, (err) => {

        }); // Delete the file async. (But we don't check the result)

        if(cb)
            cb(err.message);
    });
};

/**
 *
 */
let checkAndDownloadImage = function() {
    let serverVersion,
        localVersion,
        update = false;
    async.series([
        function(async_cb) {
            //download pisignage.com/releases/package.json
            download("http://pisignage.com/releases/package.json",serverFile, (err) => {
                if (err)
                    logger.error(err);
                async_cb(err);
            });
        },
        function(async_cb) {
            try {
                let serverdata = fs.readFileSync(serverFile);
                serverVersion = JSON.parse(serverdata).version;
            } catch (e) {
                return async_cb(true);
            }

            fs.stat(packageJsonFile, function(err) {
                if (err)
                    update = true;
                async_cb(err);
            });
        },
        function(async_cb) {
            //read version, different from local one
            try {
                let localData = fs.readFileSync(packageJsonFile);
                localVersion = JSON.parse(localData).version;
            } catch (e) {
                return async_cb(true);
            }
            if (serverVersion !== localVersion) {
                update = true;
            }
            async_cb();
        },
        function (async_cb) {
            //read version, different from local one
            if (!update) {
                fs.access(path.join(config.releasesDir,"piimage"+serverVersion+"-v6.zip"), (fs.constants || fs).F_OK, (err) => {
                    if (err)
                        update = true;
                    logger.error(err);
                    async_cb(err);
                });
            } else {
                async_cb();
            }
        }
    ], function(err){
        if (!update)
            return;

        logger.error("new version is available: " + serverVersion);

        let serverLink = "http://pisignage.com/releases/piimage" + serverVersion + ".zip",
            imageFile = path.join(config.releasesDir, "piimage" + serverVersion + ".zip"),
            serverLinkV6 = "http://pisignage.com/releases/piimage" + serverVersion + "-v6.zip",
            imageFileV6 = path.join(config.releasesDir, "piimage" + serverVersion + "-v6.zip"),
            linkFile = path.join(config.releasesDir, "pi-image.zip"),
            linkFileV6 = path.join(config.releasesDir,"pi-image-v6.zip"),
            linkFileV6_2 = path.join(config.releasesDir, ("piimage" + serverVersion).slice(0, ("piimage" + serverVersion).indexOf(".")) + "-v6.zip");
        download(serverLink,
            imageFile,
            (err) => {
                if (err) {
                    logger.error(err);
                } else {
                    download(serverLinkV6,
                        imageFileV6, (err) => {
                            if (err) {
                                logger.error(err);
                            } else {
                                //create the symbolic link pi-image.zip to the the donwloaded zip file
                                fs.unlink(linkFile, (err) => {
                                    fs.symlink(imageFile, linkFile, (err) => {
                                        if (err)
                                            logger.error(err);
                                    });
                                });
                                fs.unlink(linkFileV6, (err) => {
                                    fs.symlink(imageFileV6, linkFileV6, (err) => {
                                        if (err)
                                            logger.error(err);
                                    });
                                });
                                fs.unlink(linkFileV6_2, (err) => {
                                    fs.symlink(imageFileV6, linkFileV6_2, (err) => {
                                        if (err)
                                            logger.error(err);
                                    });
                                });
                                // update local package.json with the downloaded one
                                fs.unlink(packageJsonFile, function (err) {
                                    fs.rename(serverFile, packageJsonFile, function (err) {
                                        if (err)
                                            logger.error(err);
                                    });
                                });
                                logger.info("piSignage image updated to " + serverVersion);
                            }
                        });
                }
            });
    });
};

/**
 *
 * @type {*|*}
 */
dayScheduler = scheduler.scheduleJob({
    hour: 0,
    minute: 0
}, checkAndDownloadImage);
checkAndDownloadImage();

