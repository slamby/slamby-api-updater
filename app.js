var express = require('express');
var app = express();
var github = require('octonode');
var request = require('request');
var fs = require('fs');
var shell = require('shelljs');

const composeFilePath = 'tmp/docker-compose.yml';

app.get('/', function (req, res) {
    var version = req.params['version']; 
    var client = github.client();
    
    var ghrelease = client.release('slamby/slamby-api', 'latest');
    ghrelease.info(function(err, release, headers) {
        if (err != null){
            console.error(err);
            var errorObj = { Errors: ["There was an error during the update process!"] };
            res.status(500).json(errorObj);
        }
        for (var i = 0, len = release.assets.length; i < len; i++) {
            if (release.assets[i].name != "docker-compose.yml") continue;
            var composeFileUrl = release.assets[i].browser_download_url;

            request(composeFileUrl).pipe(fs.createWriteStream(composeFilePath));

            shell.exec(`docker-compose -f ${composeFilePath} up -d --remove-orphans`, {silent:true}, function(code, stdout, stderr) {
                if (code === 0){
                    res.status(200).send("OK");
                } else {
                    console.error(stderr);
                    var errorObj = { Errors: ["There was an error during the update process!"] };
                    res.status(500).json(errorObj);
                }
            });
        }
    });
});

app.listen(7000, function () {
  console.log('Slamby API updater app listening on port 7000!');
});