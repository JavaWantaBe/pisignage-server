'use strict';

const config = require('../../config/config'),
      googleapis = require('googleapis'),
      fs = require('fs'),
      logger = require('node-logger').createLogger(),
      path = require('path');


/*
 ===========================================================================
 Google Calendar Functions
 ===========================================================================
 */
const OAuth2 = googleapis.auth.OAuth2,
      oauth2Client = new OAuth2(config.gCalendar.CLIENT_ID, config.gCalendar.CLIENT_SECRET, config.gCalendar.REDIRECT_URL),
      calendar = googleapis.calendar('v3');

/**
 *
 * @param file
 * @returns {*}
 */
let readGcal = function (file) {
    let fileContents;

    try {
        fileContents = JSON.parse(fs.readFileSync(file, 'utf8'));
        oauth2Client.setCredentials(fileContents.tokens);
    } catch (e) {
        logger.error("unable to set credentials for auth client " + e);
    }

    return fileContents;
};

/**
 *
 * @param calData
 * @param cb
 */
exports.index = function (calData, cb) {
    oauth2Client.setCredentials(calData.tokens);
    calendar.calendarList.list( {
        minAccessRole: 'owner',
        auth: oauth2Client},
        (err, calendarList) => {
            err ? cb(err) : cb(null, calendarList);
        });
};

/**
 *
 * @param file
 * @param options
 * @param cb
 */
exports.getCalendar = function (file, options, cb) {
    let gTokens = readGcal(path.resolve(config.mediaDir, file));   //no need for istallation since it is called from Pi

    options.calendarId = gTokens.selectedEmail;
    options.auth = oauth2Client;
    calendar.events.list(options, (err, eventsList) => {
        err ? cb(err) : cb(null, eventsList);
    });
};