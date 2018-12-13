"use strict";

// Default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const express = require("express"),
      socketio = require("socket.io");

const path = require('path'),
      fs = require('fs'),
      logger = require('node-logger').createLogger(),
      config = require(path.join(__dirname, '/config/config'));

// Bootstrap models
const modelsPath = path.join(__dirname, 'app/models');
const mongoose = require('mongoose');

// Start server
let app = express();
let server = null;

// Socket IO
let ioNew = socketio(server,{
    path: '/newsocket.io',
    serveClient: true,
    // below are engine.IO options
    pingInterval: 45000,
    pingTimeout: 45000,
    upgradeTimeout: 60000,
    maxHttpBufferSize: 10e7
});


/**
 * System readiness check
 */
require('./app/others/system-check')();

/**
 * Connect to database
 */
mongoose.connect(config.mongo.uri, config.mongo.options).then(
    () => {
        logger.info('attached to database');
    },
    err => {
        logger.error('unable to attach to database');
        process.exit(1);
    }
);

fs.readdirSync(modelsPath).forEach(file => {
    require(modelsPath + '/' + file);
});

// Express settings
require('./config/express')(app);

/**
 * HTTP/HTTPS RUN
 */
if (config.https) {
    const https_options = {
        ca: fs.readFileSync("/home/ec2-user/.ssh/intermediate.crt"),
        key: fs.readFileSync("/home/ec2-user/.ssh/pisignage-server.key"),
        cert: fs.readFileSync("/home/ec2-user/.ssh/pisignage-server.crt")
    };

    server = require('https').createServer(https_options, app);
    //require('http').createServer(app).listen(80);
}
else {
    server = require('http').createServer(app);
}

//Bootstrap socket.io
require('./app/controllers/server-socket-new').startSIO(ioNew);
require('./app/controllers/scheduler');

server.listen(config.port, () => {
    logger.info('Express server listening on port:' + config.port + ' in:' + app.get('env') + ' mode');
});

server.on('connection', (socket) => {
    // 60 minutes timeout
    socket.setTimeout(3600000);
});


// Expose app
module.exports = app;


// console.log('********************************************************************');
// console.log('*    After update if you do not see your groups, please change     *');
// console.log('*    change the uri variable to "mongodb://localhost/pisignage-dev"*');
// console.log('*    in config/env/development.js and restart the server           *');
// console.log('******************************************************************\n');

