'use strict';

/**
 * Misc modules needed for operation
 */
const fs = require('fs'),
      path = require('path'),
      async = require('async'),
      logger = require('node-logger').createLogger(),
      _ = require('lodash');

const serverIp = require('ip').address();

const config = require('../../config/config'),
      rest = require('../others/restware');

const mongoose = require('mongoose'),
      Settings = mongoose.model('Settings');

let licenseDir = config.licenseDirPath;
let settingsModel = null;


/**
 * @brief Gets the .txt files from the license directory
 * @param cb
 */
let getTxtFiles = function(cb){
    let txtOnly;

    fs.readdir(licenseDir, (err,files) => {
        if(err)
            return cb(err,null);

        txtOnly = files.filter((file) => {
            return file.match(/\.txt$/i);  // remove dot, hidden system files
        });

        cb(null,txtOnly);
    });
};

/**
 * @brief
 * @param req
 * @param res
 */
exports.index = function(req, res){
    getTxtFiles((err, files) => {
        return (err) ?
            rest.sendError(res,'error in reading license directory',err) :
            rest.sendSuccess(res,'total license list ',files);
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.saveLicense = function(req, res){ // save license files
	let uploadedFiles = req.files.assets, savedFiles = [];
		
	async.each(uploadedFiles,(file, callback) => {
		fs.rename(file.path,path.join(licenseDir, file.originalname), (err) => {
			if(err)
				return callback(err);
			savedFiles.push({name: file.originalname , size: file.size});
			callback();
		});
	},function(err){
		return (err) ?
            rest.sendError(res,'Error in saving license ', err) :
            rest.sendSuccess(res,'License saved successfully', savedFiles);
	});
};

/**
 *
 * @param req
 * @param res
 */
exports.deleteLicense = function(req, res){ // delete particular license and return new file list
	fs.unlink(path.join(licenseDir, req.params.filename), (err) => {
		if(err)
			return rest.sendError(res,"License " + req.params.filename + " can't be deleted", err);
		
		getTxtFiles((err,files) => { // get all license
			if(err)
				return rest.sendError(res,'error in reading license directory',err);

			return rest.sendSuccess(res,"License " + req.params.filename + " deleted successfully", files);
		});
	});
};

/**
 * Sets up model if not found in database
 * @param cb
 */
exports.getSettingsModel = function(cb) {
    Settings.findOne((err, settings) => {
        if (err || !settings) {
            if (settingsModel) {
                cb(null, settingsModel);
            } else {
                settingsModel = new Settings();
                settingsModel.save(cb);
            }
        } else {
            cb(null,settings);
        }
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.getSettings = function(req,res) {
    exports.getSettingsModel((err, data) => {
        if (err) {
            return rest.sendError(res, 'Unable to access Settings', err);
        } else {
            let obj = data.toObject();
            obj.serverIp = serverIp;
            return rest.sendSuccess(res, 'Settings', obj);
        }
    });
};

/**
 *
 * @param req
 * @param res
 */
exports.updateSettings = function(req, res) {
    let restart = false;

    Settings.findOne(function (err, settings) {
        if (err)
            return rest.sendError(res, 'Unable to update Settings', err);

        //if (settings.installation != req.body.installation)
        restart = true;

        if (settings)
            settings = _.extend(settings, req.body);
        else
            settings = new Settings(req.body);

        settings.save(function (err, data) {
            if (err) {
                rest.sendError(res, 'Unable to update Settings', err);
            } else {
                rest.sendSuccess(res, 'Settings Saved', data);
            }
            if (restart)  {
                logger.info("restarting server");
                require('child_process').fork(require.main.filename);
                process.exit(0);
            }
        });
    });
};

/**
 * @brief Gets the settings model from the database
 */
exports.getSettingsModel(function(err, settings){
    try {
        licenseDir = config.licenseDirPath + (Settings.installation || "local");
    } catch (e) {
        logger.error('error in fetching model:');
    }
});

