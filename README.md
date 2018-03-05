# About 

This is an minimal database for assigning and tracking information about mesh nodes, such as contact information for node owners and assigned static IP addresses.

# Usage

Copy config.js.example to config.js and edit to suit your needs. 

There are two levels of access control: 

*admin: Full access.
*deployer: Can only create new nodes.

You can use the hash_pass.js script to generate the hash for a new password. Remember to change the salt in config.js _before_ generating hashes.

# Building Your Own Meshnode Database

If you want to start your own fork of People's Open, you'll probably want to use your meshnode database. To do this follow these instructions,

1. Acquire a server (Ubuntu or Debian?) that is addressable over the internet (or on the mesh?)

2. Install nodejs using nvm,
```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
export NVM_DIR="$HOME/.nvm" # close and reopen your shell session
nvm install 7.10 # or higher?
```
3. Clone this repo and install dependencies,
```
git clone https://github.com/sudomesh/meshnode-database
cd meshnode-database
npm install
```
4. Copy and modify config.js
```
cp config.js.example config.js
vim config.js
```
changing the salt to something random, like say `M5`, and the host name to the IP of the server, like so,
```
module.exports = {
    salt: 'M5', // you should change this to a randomly generated salt
    hostname: '<IP_address_of_server>',
    port: 3000,
```
You may also want to change the range of IPs being handed out to something slightly different, like `101.64.0.0`, so you can differentiate your network from the main People's Open Network.
```
  subnet: '101.64.0.0/10', // the mesh subnet
  subnets_reserved: ['101.64.0.0/24', '101.64.1.0/24'], // do not assign subnets in this range
```
6. Generate new hashed passwords for both `admin` and `deployer` by running
```
./hash_pass.js
```
7. Copy the generated hashes in to `config.js`
8. Start the database with `./database.js`, should return output,
```
connect.multipart() will be removed in connect 3.0
visit https://github.com/senchalabs/connect/wiki/Connect-3.0 for alternatives
connect.limit() will be removed in connect 3.0
Starting on 165.227.44.64:3000
```

## Retreive an IP from new meshnode database

Once running a new database, you'll probably want to know how you can test that it is working and retreive an IP from it. On any given internet connected Linux (tested with Debian) computer, follow these instructions to create a node IP,

1. Clone this repo and install dependencies, assuming you already have node and npm installed,
```
git clone https://github.com/sudomesh/meshnode-database/
cd meshnode-database
npm install ssl-root-cas request 
```
2. From your meshnode database server, copy the modified config file, using something like this,
```
scp root@<IP_address_of_server>:~/meshnode-database/config.js .
```
3. Enter the 'tests' directory and copy the settings template
```
cd tests
cp settings.example settings.js
```
4. Modify `settings.js` with the plain text admin password you created in step 6 of the previous section 

5. With the meshnode database running and available online, run the `create_node.js` script either with `./create_node.js` or `node create_node.js` (note: I had to delete the first line that declares the environment for this to work)

6.On the client you should see an output that you successfully received an IP address, like so,
```
Creating node meshnode-database url: http://165.227.44.64:3000/nodes
Success: { type: 'node',
  mesh_addr_ipv4: '101.64.2.1',
  mesh_subnet_ipv4: '101.64.0.0',
  mesh_subnet_ipv4_mask: '255.192.0.0',
  mesh_subnet_ipv4_bitmask: '10',
  adhoc_addr_ipv4: '101.64.2.1',
  adhoc_subnet_ipv4_mask: '255.255.255.255',
  adhoc_subnet_ipv4_bitmask: '32',
  tun_addr_ipv4: '101.64.2.1',
  tun_subnet_ipv4_mask: '255.255.255.255',
  tun_subnet_ipv4_bitmask: '32',
  open_addr_ipv4: '101.64.2.1',
  open_subnet_ipv4: '101.64.2.0',
  open_subnet_ipv4_mask: '255.255.255.192',
  open_subnet_ipv4_bitmask: '26',
  open_dhcp_range_start: '514',
  mesh_addr_ipv6: 'a237:473:2389:a1:3ffd:2c94:234:f544',
  id: '3eba3469-b690-44eb-b79f-79f086a903ad' }
``` 
On the server, you should also see an output that a node was created and an IP handed out, 
```
retrieving all nodes
Creating node
got: { type: 'node' }
Highest:  null
Next subnet:  101.64.2.0/26
```
7. You can now start handing out IPs for your very own mesh network, next steps include building your own [exitnode](https://github.com/sudomesh/exitnode) and modifiying [makenode](https://github.com/sudomesh/makenode) to request IPs from your meshnode-database and tunnel to your exitnode! 

# Security

You should only ever run this through a reverse proxy with SSL enabled. 

# Running 

```
./database.js
```

# Production

In a production environment you probably want to automatically start it on bootup and make it restart when it crashes. 

The following assumes that you're using [nvm](https://github.com/creationix/nvm) and have your copy on `meshnode-database` in /home/meshnode/meshnode-database that will be running as the user `meshnode`.

Become the `meshnode` user and install the psy process monitor globally for that user:

```
npm install -g psy
```

Copy the init.d script to `/etc/init.d/`:

```
sudo cp production/meshnode-database.initd /etc/init.d/meshnode-database
```

If you're using systemd now do:

```
sudo systemctl daemon-reload
```

If you're on older debian/ubuntu:

```
update-rc.d meshnode-database defaults
```

Now try to start meshnode-database:

```
/etc/init.d/meshnode-database start
```

and check if it's running:

```
ps aux | grep meshnode-database
```

## SSL

You really want to run this with SSL. You should set the settings.js file to use a local > 1024 port, e.g. 3000. Then use e.g. apache or nginx as a reverse proxy on port 443 to provide SSL. Here's an example apache config for accomplishing this:

```
<VirtualHost *:80>
        ServerAdmin     juul@peoplesopen.net
        ServerName      secrets.peoplesopen.net
        ServerAlias     www.secrets.peoplesopen.net
        Redirect / https://secrets.peoplesopen.net/
</VirtualHost>

<VirtualHost *:443>
        ServerAdmin     info@secrets.peoplesopen.net
        ServerName      secrets.peoplesopen.net
        ServerAlias     www.secrets.peoplesopen.net
        DocumentRoot    /var/www/secrets.peoplesopen.net/public
        ErrorLog        /var/www/secrets.peoplesopen.net/logs/error.log
        CustomLog       /var/www/secrets.peoplesopen.net/logs/access.log combined
        LogLevel warn

        ProxyPass / http://127.0.0.1:3000/
        ProxyPassReverse / http://127.0.0.1:3000/

        <Directory />
                Options FollowSymLinks
                AllowOverride None
        </Directory>
        <Directory /var/www/secrets.peoplesopen.net/public>
                Options Indexes FollowSymLinks MultiViews
                AllowOverride FileInfo
                Order allow,deny
                allow from all
        </Directory>

        SSLEngine on
        SSLProtocol all -SSLv2 -SSLv3
        SSLCipherSuite ALL:!DH:!EXPORT:!RC4:+HIGH:+MEDIUM:!LOW:!aNULL:!eNULL
        SSLCertificateFile /etc/letsencrypt/live/secrets.peoplesopen.net/cert.pem
        SSLCertificateKeyFile /etc/letsencrypt/live/secrets.peoplesopen.net/privkey.pem
        SSLCertificateChainFile /etc/letsencrypt/live/secrets.peoplesopen.net/fullchain.pem
</VirtualHost>
```

# License 

AGPLv3. Talk to us if you have a good reason for needing a different license.

Copyright 2014-2017 Marc Juul 

# ToDo 

*Turning off access control currently does not work.
