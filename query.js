

var util = require('util');
var levelup = require('levelup');
var uuid = require('node-uuid');
var Netmask = require('netmask').Netmask;

// this function coming in next stable version of netmask
Netmask.prototype.toString = function() {
    return this.base+'/'+this.bitmask;
};

var Query = function(db, config) {

    this.config = config || {};
    this.subnet = new Netmask(config.subnet);
    this.subnets_reserved = [];
    var i;
    for(i=0; i < config.subnets_reserved.length; i++) {
        this.subnets_reserved.push(new Netmask(config.subnets_reserved[i]));
    }


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
            if(!node) {
                return;
            }
            if(node.type != 'node') {
                return;
            }
            if(!node.mesh_subnet_ipv4) {
                return;
            }

            emit(this.maxIP - this.subnetToNumber(node.mesh_subnet_ipv4));
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
        block = block.next();
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
                subnet = this.subnet.base + '/' + this.config.per_node_bitmask;
            } else {
                subnet = node.mesh_subnet_ipv4 + '/' + this.config.per_node_bitmask;
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

    this.numIPsForBitmask = function(bitmask) {
        var remainder = 32 - parseInt(bitmask);
        return Math.pow(2, remainder);
    };


    // dnsmasq expects the dhcp range start
    // to be an integer counting from the start of
    // the subnet, so we have to calculate it
    this.calcDHCPRangeStart = function(targetSubnet) {
        var offset = 0;
        var cur = new Netmask(this.subnet.base+'/'+this.config.per_node_bitmask);

        // Calculate offset to the per-node subnet within the larger mesh subnet
        while(!targetSubnet.contains(cur.toString())) {
            cur = cur.next();

            // check if we're completely out of the mesh subnet
            if(!this.subnet.contains(cur.toString())) {
                return -1;
            }
            offset += this.numIPsForBitmask(this.config.per_node_bitmask);
        }
        
        // Now we have the offset to the network address of the per-node subnet.
        // If the mesh subnet is e.g. 100.64.0.0/16 
        // and the per-node subnet is e.g. 100.64.2.0/24
        // Then the current offset would make the DHCP server hand out addresses
        // starting at 100.64.2.0 
        // But the node's own address will be 10.64.2.1
        // and we want it to hand out addresses starting at 10.64.2.2
        // so we increment by two.

        offset += 2;

        return offset;
    };

    // assign unique subnet, uuid, etc
    this.assign = function(node, callback) {
        this.getNextSubnet(function(err, subnet) {
            if(err) {
                callback(err);
                return;
            }

            var block = new Netmask(subnet);
            var meshBlock = new Netmask(this.config.subnet);

            if(!node.mesh_addr_ipv4) {
                // first ip in block
                node.mesh_addr_ipv4 = String(block.first);
                node.mesh_subnet_ipv4 = String(meshBlock.base);
                node.mesh_subnet_ipv4_mask = String(meshBlock.mask);
                node.mesh_subnet_ipv4_bitmask = String(meshBlock.bitmask);
            }

            if(!node.adhoc_addr_ipv4) {
                node.adhoc_addr_ipv4 = String(block.first);
                node.adhoc_subnet_ipv4_mask = '255.255.255.255';
                node.adhoc_subnet_ipv4_bitmask = '32';
            }

            if(!node.tun_addr_ipv4) {
                node.tun_addr_ipv4 = String(block.first);
                node.tun_subnet_ipv4_mask = '255.255.255.255';
                node.tun_subnet_ipv4_bitmask = '32';
            }

            if(!node.open_addr_ipv4) {
                node.open_addr_ipv4 = String(block.first);
                node.open_subnet_ipv4 = String(block.base);
                node.open_subnet_ipv4_mask = String(block.mask);
                node.open_subnet_ipv4_bitmask = String(block.bitmask);
            }

            if(!node.open_dhcp_range_start) {
                // Calculate DHCP range start for dnsmasq
                var dhcpRangeStart = this.calcDHCPRangeStart(subnet)
                if(dhcpRangeStart < 0) {
                    return callback("Could not calculate DHCP range start index");
                }

                node.open_dhcp_range_start = String(dhcpRangeStart);
            }

            if(!node.mesh_addr_ipv6) {
                var numbers = [];
                var i = 4;
                while(i--) {
                    // generate (up to) four-digit hex strings
                    numbers.push(Math.floor(Math.random() * 65536).toString(16));
                }
                node.mesh_addr_ipv6 = this.config.ipv6_prefix + numbers.join(':');
            }

            if(!node.id) {
                // generate random RFC 4122 v4 id
                node.id = uuid.v4(); 
            }

            callback(null, node);
        }.bind(this));

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

    this.getNodes = function(callback) {
        var nodes = [];
        this.db.createReadStream()
            .on('data', function(data) {
                var node = data.value;
                if(node.type != 'node') {
                    return;
                }
                nodes.push(node);
            }.bind(this))
            .on('error', function(err) {
                callback(err);
            }.bind(this))
            .on('end', function() {
                callback(null, nodes);
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

        this.assign(node, function(err, node) {
            if(err) {
                callback("assign error: " + err);
                return;
            }
            if(!node.id) {
                callback("Cannot create node without an id");
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
