'use strict';

let iosockets = null;     //holds all the clients io.sockets

const players = require('./players'),
      logger = require('node-logger').createLogger(),
      _ = require('lodash');

let handleClient = function (socket) {
    logger.info("connection with 2.1.1 socket.io : " + socket.id);
    socket.on('status', function (settings, status, priority) {
        let statusObject = _.extend(
            {
                lastReported: Date.now(),
                ip: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address,
                socket: socket.id,
                priority: priority
            },
            settings,
            status
        );
        statusObject.newSocketIo = true;
        players.updatePlayerStatus(statusObject);
    });

    socket.on('secret_ack', function (err) {
        players.secretAck(socket.id, err ? false : true);
    });

    socket.on('shell_ack', function (response) {
        players.shellAck(socket.id, response);
    });

    socket.on('snapshot', function (response) {
        players.piScreenShot(socket.id,response);
    });

    socket.on('upload', function (player, filename, data) {
        players.upload(player, filename, data);
    });

    socket.on('disconnect', function (reason) {
        players.updateDisconnectEvent(socket.id,reason);
        logger.info("disconnect event: " + socket.id);
    });
};

exports.startSIO = function (io) {
    io.sockets.on('connection', handleClient);
    //io.set('log level', 0);
    iosockets = io.sockets;
};

exports.emitMessage = function (sid) {
    if (iosockets.sockets[sid]) {
        let args = Array.prototype.slice.call(arguments,1);
        iosockets.sockets[sid].emit.apply(iosockets.sockets[sid], args);
    }
};

