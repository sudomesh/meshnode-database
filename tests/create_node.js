#!/usr/bin/env nodejs

var util = require('util');

var request = require('request');

var config = require('./config.js');


var createNodeInDB = function(callback) {
    var url = 'http://'+config.hostname+':'+config.port+'/nodes';
    console.log("Creating node meshnode-database url: " + url);
    request.post(url, {
        auth: {
            user: 'deployer',
            pass: 'praisebob'
        }, 
        form: {
            data: JSON.stringify({
                type: 'node'
            })
        }
    }, function(err, resp, body) {
        if(err) return callback(err);
        if(!body) return callback("No data returned from server");
        try {
            var obj = JSON.parse(body);
        } catch(e) {
            return callback("Invalid JSON returned from server: " + body);
        }
        if(obj.status != 'success') {
            if(!obj.msg) {
                return callback("Server returned unspecified error");
            }
            return callback(obj.msg)
        }
        if(!obj.data) return callback("Empty response returned from server");
        callback(null, obj.data);
    });
}


createNodeInDB(function(err, data) {
    if(err) {
        return console.error("Error: " + err);
    }
    console.log("Success: " + util.inspect(data));
});
