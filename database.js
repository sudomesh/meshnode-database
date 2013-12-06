#!/usr/bin/node

/*
  This is a simply database with a REST HTTP JSON API
  for registering new nodes in the sudo mesh network
  and assigning unique values such as IP addresses.

  Copyright: 2013 Marc Juul
  License: AGPLv3
*/

var util = require('util');
var path = require('path');
var express = require('express');
var levelQuery = require('level-queryengine');
var jsonqueryEngine = require('jsonquery-engine');
var pairs = require('pairs');
var levelup = require('levelup');



function validate_and_assign(node, callback) {
    // TODO implement me
    callback(null, node);
}

function error(res, msg) {
    res.status(404).send(JSON.stringify({
        status: 'error',
        msg: "data parameter not set"
    }));
}

function respond(res, data) {
    res.send(JSON.stringify({
        status: 'success',
        data: data
    }));
}

function get_node(res, id, callback) { 
    var nodes = [];
    db.query({type: 'node', id: id}).on('data', function(node) {
        nodes.push(node);
    }).on('end', function() {
        if(nodes.length <= 0) {
            callback("no nodes exist with specified id");
            return;
        } else {
            callback(null, nodes[0]);
        }
    });
}

// if a node exists with same id, this will overwrite it
function create_node(res, node, callback) {
    if(node.type != 'node') {
        callback("type must be 'node'");
        return;
    }
    if(!node.id) {
        callback("node must have an id");
        return
    }
    validate_and_assign(node, function(err, node) {
        if(err) {
            callback("validate or assign error: " + err);
            return;
        }
        db.put(node.id, node, function(err) {
            if(err) {
                callback("error creating node in db: " + err);
                return;
            }
            callback(null, node);
        });
    })
}


var db = levelQuery(levelup('meshnode.db', {encoding: 'json'}));
db.query.use(jsonqueryEngine());

// Create indices
db.ensureIndex('*', 'pairs', pairs.index);

var app = express();

// server static content from the /static dir
app.use('/', express.static(path.join(__dirname, 'static')));

// get node
app.get('/nodes/:id', function(req, res){
    if(!req.params.id) {
        error(res, "node id must be specified in request");
        return;
    }
    get_node(res, req.params.id, function(err, node) {
        if(err) {
            error(res, "error retrieving node: " + err);
            return;
        }
        respond(res, node);
    });
});

// create node
app.post('/nodes', function(req, res){
    if(!req.params.data) {
        error(res, "data parameter not set or empty");
        return;
    }
    var data = JSON.parse(req.params.data);
    if(!data) {
        error(res, "data parameter is not valid json");
        return;
    }
    create_node(res, data, function(err, node) {
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
    if(!req.params.data) {
        error(res, "data parameter not set or empty");
        return;
    }
    var data = JSON.parse(req.params.data);
    if(!data) {
        error(res, "data parameter is not valid json");
        return;
    }
    get_node(res, req.params.id, function(err, node) {
        if(err) {
            error(res, "error retrieving node: " + err);
            return;
        }
        create_node(res, data, function(err, node) {
            if(err) {
                error(res, "error updating node with id '"+data.id+"': " + err);
                return;
            }
            respond(res, node);
        });
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

//app.get('/', function(req, res) {
//    res.redirect('/static');
//});

var port = 3000;
console.log("Starting on port " + port);
app.listen(3000);
