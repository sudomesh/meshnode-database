

var util = require('util');
var levelup = require('levelup');
var uuid = require('node-uuid');
var Netmask = require('netmask').Netmask;

// this function coming in next stable version of netmask
Netmask.prototype.toString = function() {
    return this.base+'/'+this.bitmask;
};

var Query = function(db) {

    // TODO load this from config file
    this.subnet = new Netmask('10.0.0.0/8');
    this.subnets_reserved = [
        new Netmask('10.0.0.0/24'), 
        new Netmask('10.42.0.0/24')
    ];

    this.indexes = ['subnet_highest_first'];

    this.db = db;

    this.init = function(reIndex, callback) {

        this.maxIP = this.ipToNumber('255.255.255.255');

        if(reIndex) {
            this.dropIndexes(this.indexes, function(err) {
                if(err) {
                    callback(err);
                    return;
                }
                this.ensureIndexes(function(err) {
                    if(err) {
                        callback(err)
                        return;
                    }
                    callback();
                }.bind(this));
            }.bind(this));
        } else {
            this.ensureIndexes(callback);            
        }
    };

    this.dropIndexes = function(indexes, callback, i) {
        if(!i) {
            i = 0;
        } else if(i > indexes.length - 1) {
            callback();
            return;
        }
        this.db.dropIndex(indexes[i], function(err) {
            if(err) {
                callback("Error dropping index: " + indexes[i]);
                return;
            }
            this.dropIndexes(indexes, callback, i+1);
        }.bind(this));
    };

    this.ensureIndexes = function(callback) {
        this.ensureSubnetIndex(callback);
    };

    this.ensureSubnetIndex = function(callback) {
        this.db.ensureIndex('subnet_highest_first', 'property', function(key, node, emit) {    
            if(node.type != 'node') {
                return;
            }
            if(!node.subnet) {
                return;
            }
            
            emit(this.maxIP - this.subnetToNumber(node.subnet));
        }.bind(this), callback);
    };

    this.isValidSubnet = function(subnet) {
        if(typeof subnet == 'object') {
            subnet = subnet.toString();
        }
        if(!this.subnet.contains(subnet)) {
            return false;
        }
        var i;
        for(i=0; i < this.subnets_reserved.length; i++) {
            if(this.subnets_reserved[i].contains(subnet)) {
                return false;
            }
        }
        return true;
    };

    this.subnetToNumber = function(subnet) {
        var ipsub = subnet.split('/');
        return this.ipToNumber(ipsub[0]);
    };

    this.ipToNumber = function(ip) {
        var number = 0;
        var parts = ip.split('.');
        var i;
        for(i=0; i < parts.length; i++) {
            // the ">>> 0" part means "keep it unsigned"
            number += (parts[i] << ((3-i) * 8)) >>> 0;
        }
        return number;
    };

    this.subnetIncrement = function(subnet, nocheck) {
        var block = new Netmask(subnet);
        block = block.next()
        if(nocheck) {
            return block;
        }
        while(true) {
            if(!this.subnet.contains(block.toString())) {
                // outside of pool bounds
                return false;
            }
            if(!this.isValidSubnet(block)) {
                block = block.next();
                continue;
            }
            return block.toString();
        }
    };

    this.getNodeWithHighestSubnet = function(callback) {
        var keys = [];
        this.db.indexes['subnet_highest_first'].createIndexStream({
            limit: 1
        }).on('data', function(data) {
            keys.push(data.value);
        }.bind(this)).on('close', function(data) {
            if(keys.length < 1) {
                callback(null, null);
                return;
            }
            this.db.get(keys[0], callback);
        }.bind(this));
    };

    // Get the next un-assigned subnet address in the range
    this.getNextSubnet = function(callback) {
        this.getNodeWithHighestSubnet(function(err, node) {
            if(err) {
                callback(err);
                return;
            }
            var subnet;
            if(!node) {
                subnet = this.subnet.base+'/24';
            } else {
                subnet = node.subnet;
            }
            // find next available subnet
            subnet = this.subnetIncrement(subnet);
            if(!subnet) {
                callback("Could not assign unique subnet: None available");
                return;
            }
            callback(null, subnet);
        }.bind(this));
    };

    this.validateAndAssign = function(node, callback) {
        this.getNextSubnet(function(err, subnet) {
            if(err) {
                callback(err);
                return;
            }
            node.subnet = subnet;
            var block = new Netmask(subnet);
            node.ip = block.first; // first ip in block
            node.netmask = block.mask;
            callback(null, node);
        });

    };

    this.updateNode = function(node, callback) {
        var ops = [
            {type: 'del', key: node.id},
            {type: 'put', key: node.id, value: node}
        ];

        this.db.batch(ops, function(err) {
            if(err) {
                callback("error updating node: " + node.id);
                return;
            }
            callback(null, node);
        });
    };

    this.getNode = function(id, callback) {

        var nodes = [];
        this.db.query({$and: [{type: 'node'}, {id: id}]}).on('data', function(node) {
            nodes.push(node);
        }.bind(this)).on('end', function() {
            if(nodes.length <= 0) {
                callback("no nodes exist with specified id");
                return;
            } else {
                callback(null, nodes[0]);
            }
        }.bind(this)).on('stats', function(stat) {
            // do nothing
        }.bind(this)).on('error', function(err) {
            callback(err);
            return;
        }.bind(this)).on('close', function(stat) {
            // do nothing
        }.bind(this));
    },
    
    this.createNode = function(node, callback) {
        if(node.type != 'node') {
            callback("type must be 'node'");
            return;
        }
        if(!node.id) {
            // generate random RFC 4122 v4 id
            node.id = uuid.v4(); 
        }
        this.validateAndAssign(node, function(err, node) {
            if(err) {
                callback("validate or assign error: " + err);
                return;
            }
            this.db.put(node.id, node, function(err) {
                if(err) {
                    callback("error creating node in db: " + err);
                    return;
                }
                callback(null, node);
            }.bind(this));
        }.bind(this));
    }; 
};

module.exports = {
    Query: Query
};