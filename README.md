# About 

This is a minimal database for assigning and tracking information about mesh nodes, such as contact information for node owners and assigned static IP addresses.

# Usage

Copy config.js.example to config.js and edit to suit your needs. 

There are two levels of access control: 

*admin: Full access.
*deployer: Can only create new nodes.

You can use the hash_pass.js script to generate the hash for a new password. Remember to change the salt in config.js _before_ generating hashes.

# Security

You should only ever run this through a reverse proxy with SSL enabled. 

# Prerequisites 

This is node.js app. On Debian-based systems you can install node.js with:

```
sudo aptitude install nodejs
```

Then install the required node.js modules with:

```
cd node-database/
npm install
```

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