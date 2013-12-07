#!/usr/bin/node

/*
  This is a simply database with a REST HTTP JSON API
  for registering new nodes in the sudo mesh network
  and assigning unique values such as IP addresses.

  Copyright: 2013 Marc Juul
  License: AGPLv3
*/

var uuid = require('node-uuid');
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
        msg: msg
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
    console.log("get!");
    db.query({$and: [{type: 'node'}, {id: 42}]}).on('data', function(node) {
        console.log('===== get data');
        nodes.push(node);
    }).on('end', function() {
        if(nodes.length <= 0) {
            callback("no nodes exist with specified id");
            return;
        } else {
            callback(null, nodes[0]);
        }
    }).on('stats', function(stat) {
        // do nothing
    }).on('error', function(err) {
        console.log('===== get_node error: ' + err);
    }).on('close', function(stat) {
        // do nothing
    });
}

function update_node(res, node, callback) {

    var ops = [
        {type: 'del', key: node.id},
        {type: 'put', key: node.id, value: node}
    ];

    db.batch(ops, function(err) {
        if(err) {
            callback("error updating node: " + node.id);
            return;
        }
        callback(null, node);
    });

/*
    db.batch()
        .del(node.id)
        .put(node)
        .error(function(err) {
            callback("error updating node: " + node.id);
            return;
        })
        .write(function() {
            callback(null);
        });
*/
}

function create_node(res, node, callback) {
    if(node.type != 'node') {
        callback("type must be 'node'");
        return;
    }
    if(!node.id) {
        node.id = uuid.v4(); // generate random RFC4122 v4 id
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
//db.ensureIndex('*', 'pairs', pairs.index);

var app = express();

// server static content from the /static dir
app.use('/', express.static(path.join(__dirname, 'static')));

// for parsing post request
app.use(express.bodyParser());

// get node
app.get('/nodes/:id', function(req, res){
    if(!req.params.id) {
        error(res, "node id must be specified in request");
        return;
    }
    console.log("retrieving node with id: " + req.params.id);
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
    if(!req.body.data) {
        error(res, "data parameter not set or empty");
        return;
    }
    var data = JSON.parse(req.body.data);
    if(!data) {
        error(res, "data parameter is not valid json");
        return;
    }
    update_node(res, data, function(err, node) {
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

var port = 3000;
console.log("Starting on port " + port);
app.listen(3000);
