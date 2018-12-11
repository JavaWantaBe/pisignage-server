'use strict';

let sendSuccess = function (res, msg, data) {
    if (!res)
        return;
    else {
        let out = {};
        out.stat_message = msg;
        out.data = data;
        out.success = true;

        res.contentType('json');
        return res.json(out);
    }
};

let sendError = function (res, msg, err) {
    if (!res)
        return;
    else {
        let out = {},
            errmsg = err ? err.toString() : "";
        out.stat_message = msg + errmsg;
        out.success = false;

        res.contentType('json');
        return res.json(out);
    }
};


module.exports = {
    sendSuccess: sendSuccess,
    sendError: sendError
};

