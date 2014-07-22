# About 

This is an minimal database for assigning and tracking information about mesh nodes, such as contact information for node owners and assigned static IP addresses.

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

# License 

AGPLv3. Talk to us if you have a good reason for needing a different license.

Copyright 2014 Marc Juul 

# ToDo 

*Turning off access control currently does not work.