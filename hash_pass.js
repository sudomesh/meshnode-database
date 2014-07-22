#!/usr/bin/env node

var crypto = require('crypto');
var stdin = process.openStdin();

var config = require('./config.js');

// Get a password from the console, printing stars while the user types
var getPassword = function(callback) {
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  stdin.setRawMode(true);  
  password = ''
  process.stdin.on('data', function(str) {
    str = str + '';
    var i, char;
    for(i=0; i < str.length; i++) {
      char = str[i];
      switch (char) {
      case "\n": case "\r": case "\u0004": // return
        stdin.setRawMode(false)
        callback(password);
        stdin.pause()
        return;
      case "\u0003": // ctrl-c
        process.exit()
        return;
      case "\u007f": // backspace
        process.stdout.write("\b \b");
        password = password.slice(0, password.length-1);
        break;
      default:
        process.stdout.write('*')
        password += char;
      }
    }
  });
}

function hashPass(pass) {
    var hash = crypto.createHash('sha1');
    hash.update(config.salt);
    hash.update(pass);
    return hash.digest('base64');
}

process.stdout.write("Enter password to be hashed: ");

getPassword(function(pass) {
    console.log("\nYour hash is: " + hashPass(pass));
});
