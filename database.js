#!/usr/bin/env node

/*
  This is a simply database with a HTTPS JSON API
  for registering new nodes in the sudo mesh network
  and assigning unique values such as IP addresses.

  Copyright: 2013 Marc Juul
  License: AGPLv3
*/

// external libraries
var util = require('util');
var path = require('path');
var crypto = require('crypto');
var express = require('express');
var levelQuery = require('level-queryengine');
var jsonqueryEngine = require('jsonquery-engine');
var pairs = require('pairs');
var levelup = require('levelup');

// internal requires
var query = require('./query.js');

// configuration
var config = require('./config.js');

function error(res, msg) {
    res.status(404).send(JSON.stringify({
        status: 'error',
        msg: msg
    }));
}

function respond(res, data) {
    res.send(JSON.stringify({
        status: 'success',
        data: data
    }));
}

// ========================================================


var app = express();

// serve static content from the /static dir
app.use('/', express.static(path.join(__dirname, 'static')));

// for parsing post request
app.use(express.bodyParser());

function hashPass(pass) {
    var hash = crypto.createHash('sha1');
    hash.update(config.salt);
    hash.update(pass);
    return hash.digest('base64');
}

function checkAuth(user, pass, minRole, callback) {
    var i;
    for(i=0; i < config.acl.length; i++) {
        if(user === config.acl[i].username && hashPass(pass) == config.acl[i].password) {
            if(minRole === 'admin' && config.acl[i].role === 'admin') {
                callback(null, true);
                return;  
            }
            if(minRole === 'deployer' && (config.acl[i].role === 'deployer') || (config.acl[i].role === 'admin')) {
                callback(null, true);
                return;
            }
        }
    }
    callback(null, false);
}

var adminAuth;
var deployterAuth;

if(config.access_control) {
    adminAuth = express.basicAuth(function(user, pass, callback) {
        checkAuth(user, pass, 'admin', callback);
    });
    
     deployerAuth = express.basicAuth(function(user, pass, callback) {
        checkAuth(user, pass, 'deployer', callback);
    });
}

// get all nodes
app.get('/nodes', adminAuth, function(req, res){
    console.log("retrieving all nodes");
    q.getNodes(function(err, nodes) {
        if(err) {
            error(res, "error retrieving nodes: " + err);
            return;
        }
        respond(res, nodes);
    });
});


// get node by id
app.get('/nodes/:id', adminAuth, function(req, res){
    if(!req.params.id) {
        error(res, "node id must be specified in request");
        return;
    }
    console.log("retrieving node with id: " + req.params.id);
    q.getNode(req.params.id, function(err, node) {
        if(err) {
            error(res, "error retrieving node: " + err);
            return;
        }
        respond(res, node);
    });
});


// create node
app.post('/nodes', deployerAuth, function(req, res){
    console.log('params: ' + util.inspect(req.body));
    if(!req.body.data) {
        error(res, "data parameter not set or empty");
        return;
    }
    var data = JSON.parse(req.body.data);
    if(!data) {
        error(res, "data parameter is not valid json");
        return;
    }
    q.createNode(data, function(err, node) {
        if(err) {
            error(res, "error creating node: " + err);
            return;
        }
        respond(res, node);
    });
})


// update node
app.put('/nodes/:id', adminAuth, function(req, res){
    if(!req.params.id) {
        error(res, "node id must be specified in request");
        return;
    }
    if(!req.body.data) {
        error(res, "data parameter not set or empty");
        return;
    }
    var data = JSON.parse(req.body.data);
    if(!data) {
        error(res, "data parameter is not valid json");
        return;
    }
    q.updateNode(data, function(err, node) {
        if(err) {
            error(res, "error retrieving node: " + err);
            return;
        }
        respond(res, node);
    });
});

// get node
app.delete('/nodes/:id', adminAuth, function(req, res){
    if(!req.params.id) {
        error(res, "node id must be specified in request");
        return;
    }
    db.del(req.params.id, function(err) {
        if(err) {
            error(res, "error deleting node: " + err);
            return;
        }
        respond(res);
    })
});

// ========================================================

function createFakeData(q) {
    q.createNode({
        type: 'node'
    }, function(err, node) {
        console.log('Got: ' + util.inspect(node));
    });
};


var db = levelQuery(levelup('meshnode.db', {encoding: 'json'}));
db.query.use(jsonqueryEngine());

var q = new query.Query(db);

q.init(true, function(err) {
    if(err) {
        console.log("Query error: " + err);
        return;
    }

    var port = config.port;
    var hostname = config.hostname || 'localhost';

    console.log("Starting on " + hostname + ":" + port);

    app.listen(port, hostname);
});

