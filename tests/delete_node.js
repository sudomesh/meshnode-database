#!/usr/bin/env nodejs

var util = require('util');
var path = require('path');

var request = require('request');

var sslRootCAs = require('ssl-root-cas')
sslRootCAs.inject(); // inject additional root CAs that node does not include
sslRootCAs.addFile(path.join(__dirname, 'certs', 'sub.class1.server.startcom.ca.pem'));


var settings = require('./settings.js');

if(process.argv.length != 3) {
  console.error("Usage: ./delete_node.js <node_id>")
  process.exit(1);
}

var deleteNodeFromDB = function(node_id, callback) {
    var url = settings.url+'/nodes/'+node_id;
    console.log("Deleting node " + node_id + " via meshnode-database url: " + url);
    request.del(url, {
        auth: {
            user: settings.username,
            pass: settings.password
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

var node_id = process.argv[2];

deleteNodeFromDB(node_id, function(err, data) {
    if(err) {
        return console.error("Error: " + err);
    }
    console.log("Success: " + util.inspect(data));
});
