#!/usr/bin/env nodejs

/*
  This is a simply database with a HTTPS JSON API
  for registering new nodes in the sudo mesh network
  and assigning unique values such as IP addresses.

  Copyright: 2013 2015 Marc Juul
  License: AGPLv3
*/

// external libraries
var util = require('util');
var path = require('path');
var crypto = require('crypto');
var express = require('express');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth');
var pairs = require('pairs');
var levelup = require('levelup');

var wikidb = require('wikidb');
var through = require('through2');

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
app.use(bodyParser.urlencoded({extended: true}));

function hashPass(pass) {
    var hash = crypto.createHash('sha1');
    hash.update(config.salt, 'utf8');
    hash.update(pass, 'utf8');
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

function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Mesh Database Auth Needed');
    return res.send(401);
};

var adminAuth = function(req, res, next) {next()};
var deployerAuth = function(req, res, next) {next()};

var authorizer = function(role) {
    return function(req, res, next) {
        var user = basicAuth(req);
        if(!user || !user.name || !user.pass) {
            return unauthorized(res);
        }
        checkAuth(user.name, user.pass, role, function(err, isAuthed) {
            if(err) {
                console.error(err);
                return unauthorized(res);
            }
            if(!isAuthed) {
                return unauthorized(res);
            }
            return next();
        });
    };
}
        
if(config.access_control) {
    adminAuth = authorizer('admin');
    deployerAuth = authorizer('deployer');
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

// add test node
app.get('/add-test-node', adminAuth, function(req, res){
    console.log("adding test node");
    q.addTestNode(function(err, key) {
        if(err) {
            console.error("got here err");
            error(res, "error creating test node: " + err);
            return;
        }
        console.log("got here");
        respond(res, key);
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
    console.log('Creating node');
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

var ldb = levelup('db/meshnode.db');

var db = wikidb(ldb, {dir: 'db/meshnode.blob'});

var q = query(db, config);

var port = config.port;
var hostname = config.hostname || 'localhost';

console.log("Starting on " + hostname + ":" + port);

app.listen(port, hostname);


