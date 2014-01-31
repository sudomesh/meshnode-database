#!/usr/bin/env node

/*
  This is a simply database with a REST HTTP JSON API
  for registering new nodes in the sudo mesh network
  and assigning unique values such as IP addresses.

  Copyright: 2013 Marc Juul
  License: AGPLv3
*/

// external libraries
var util = require('util');
var path = require('path');
var express = require('express');
var levelQuery = require('level-queryengine');
var jsonqueryEngine = require('jsonquery-engine');
var pairs = require('pairs');
var levelup = require('levelup');

// internal requires
var query = require('./query.js');


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

// server static content from the /static dir
app.use('/', express.static(path.join(__dirname, 'static')));

// for parsing post request
app.use(express.bodyParser());

// get all nodes
app.get('/nodes', function(req, res){
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
app.get('/nodes/:id', function(req, res){
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
app.post('/nodes', function(req, res){
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
app.put('/nodes/:id', function(req, res){
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
app.delete('/nodes/:id', function(req, res){
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

//    createFakeData(q);

    var port = 3000;
    console.log("Starting on port " + port);
    app.listen(port);
});

