'use strict';

const mongoose = require('mongoose'),
      Group = mongoose.model('Group'),
      fs = require('fs'),
      config = require('../../config/config'),
      rest = require('../others/restware'),
      _ = require('lodash'),
      path = require('path'),
      async = require('async');

const serverMain = require('./server-main'),
      licenses = require('./licenses');

let installation;

licenses.getSettingsModel(function(err,settings){
    installation = settings.installation || "local";
});

/**
 *
 * @param group
 * @param cb
 */
exports.newGroup = function (group, cb) {
    let object;

    Group.findOne({name:group.name}, (err,data) => {
        if (err || !data) {
            object = new Group(group);
        } else {
            object = _.extend(data, group);
        }
        //create a sync folder under sync_folder
        if (!object.name) {
            console.log("can not be null: "+object.name);
            return cb('Unable to create a group folder in server: ' + object.name);
        }
        fs.mkdir(path.join(config.syncDir, installation, object.name), (err) => {
            if (err && (err.code !== 'EEXIST'))
                return cb('Unable to create a group folder in server: '+err);
            else {
                object.save((err, data) => {
                    cb(err,data);
                });
            }
        });
    });
};

//Load a object
exports.loadObject = function (req, res, next, id) {
    Group.load(id, (err, object) => {
        if (err || !object)
            return rest.sendError(res,'Unable to get group details', err);

        req.object = object;
        next();
    });
};

/**
 * list of objects
 * @param req
 * @param res
 */
exports.index = function (req, res) {
    let criteria = {};

    if (req.query.string) {
        let str = new RegExp(req.query.string, "i");
        criteria.name = str;
    }

    if (req.query.all) {
        criteria.all = true;
    }

    let page = req.query.page > 0 ? req.query.page : 0;
    let perPage = req.query.per_page || 500;

    let options = {
        perPage: perPage,
        page: page,
        criteria: criteria
    };

    Group.list(options, function (err, groups) {
        if (err)
            return rest.sendError(res, 'Unable to get Group list', err);
        else
            return rest.sendSuccess(res, 'sending Group list', groups || []);
    });
};

/**
 *
 * @param req
 * @param res
 * @returns {*}
 */
exports.getObject = function (req, res) {
    let object = req.object;

    if (object) {
        return rest.sendSuccess(res, 'Group details', object);
    } else {
        return rest.sendError(res, 'Unable to retrieve Group details', err);
    }
};

/**
 *
 * @param req
 * @param res
 */
exports.createObject = function (req, res) {
    let object = req.body;

    exports.newGroup(object, (err, data) => {
        if (err)
            return rest.sendError(res, err);
        else
            return rest.sendSuccess(res, 'new Group added successfully', data);
    });
};

exports.updateObject = function (req, res) {
    let object = req.object;
    delete req.body.__v;        //do not copy version key

    let saveObject = function (err, group) {
        if (err) {
            return rest.sendError(res, err);
        } else {
            if (req.body.deploy) {
                group.lastDeployed = Date.now();
                Group.update({ _id: group._id }, { $set: {
                    lastDeployed: group.lastDeployed,
                    assets: group.assets,
                    deployedAssets: group.deployedAssets,
                    assetsValidity: group.assetsValidity
                }}).exec();
            }
            return rest.sendSuccess(res, 'updated Group details', group);
        }
    };

    if (object.name !== req.body.name) {
        fs.mkdir(path.join(config.syncDir, installation, req.body.name), (err) => {
            if (err && (err.code !== 'EEXIST'))
                console.log('Unable to create a group folder in server: ' + err);
        });
    }
    object = _.extend(object, req.body);

    if (req.body.deploy) {
        object.deployedPlaylists = object.playlists;
        object.deployedAssets = object.assets;
        object.deployedTicker = object.ticker;
    }

    //disable animation for the time being
    //object.animationEnable = false;
    object.save(function (err, data) {
        if (!err && req.body.deploy) {
            serverMain.deploy(installation,object, saveObject);
        } else {
            saveObject(err, object);
        }
    });
};


/**
 *
 * @param req
 * @param res
 * @returns {*}
 */
exports.deleteObject = function (req, res) {
    let object = req.object;

    if (!req.object || req.object.name === "default")
        return rest.sendError(res,'No group specified or can not remove default group');

    object.remove(function (err) {
        if (err)
            return rest.sendError(res, 'Unable to remove Group record', err);
        else
            return rest.sendSuccess(res, 'Group record deleted successfully');
    });
};
