'use strict';

const path = require('path'),
      FFmpeg = require('fluent-ffmpeg'),
      probe = require('node-ffprobe'),
      imageMagick = require('gm').subClass({imageMagick: true}),
      config = require('../../config/config'),
      fs = require('fs'),
      async = require('async'),
      mongoose = require('mongoose'),
      Asset = mongoose.model('Asset'),
      _ = require('lodash'),
      rest = require('../others/restware'),
      processFile = require('../others/process-file');

let sendResponse = function (res, err) {
    if (err) {
        return rest.sendError(res, 'Assets data queued for processing, but with errors: ', err);
    } else {
        return rest.sendSuccess(res, 'Queued for Processing');
    }
};

/**
 *
 * @param req
 * @param res
 */
exports.storeDetails = function (req, res) {

    var files = req.body.files;

    async.eachSeries(files, function (fileObj, array_cb) {
        var filename = fileObj.name.replace(config.filenameRegex, '');
        processFile.processFile(filename, fileObj.size,  req.body.categories, array_cb);
    }, function () {
        console.log("processed " + files.length + " files");
    });
    sendResponse(res);
};

/**
 *
 * @param name
 * @param type
 * @param categories
 * @param cb
 */
exports.storeLinkDetails = function(name, type, categories, cb) {
    processFile.processFile(name,0,categories || [],function(err){
        cb();
    });
};


/**
 *
 * @param req
 * @param res
 */
exports.updateObject = function(req,res) {
    Asset.load(req.body.dbdata._id, function (err, asset) {
        if (err || !asset) {
            return rest.sendError(res, 'Categories saving error', err);
        } else {
            delete req.body.dbdata.__v;        //do not copy version key
            asset = _.extend(asset, req.body.dbdata);
            asset.save(function (err, data) {
                if (err)
                    return rest.sendError(res, 'Categories saving error', err);

                return rest.sendSuccess(res, 'Categories saved', data);
            });
        }
    });
};

/**
 *
 * @param playlist
 * @param assets
 */
exports.updatePlaylist = function(playlist, assets) {
    Asset.update({playlists:playlist},{$pull:{playlists:playlist}},{multi:true}, function(err,num) {
        if (err) {
            return console.log("error in db update for playlist in assets "+err);
        } else {
            console.log("Deleted playlist from " + num + " records");

            Asset.update({name:{$in: assets}},{$push:{playlists:playlist}},{multi:true}, function(err,num) {
                if (err) {
                    return console.log("error in db update for playlist in assets "+err);
                } else {
                    console.log("Updated playlist to " + num + " records")
                }
            });
        }
    });
};


