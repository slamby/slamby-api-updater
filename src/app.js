var express = require('express');
var app = express();
var github = require('octonode');
var request = require('request');
var fs = require('fs');
var shell = require('shelljs');

const composeFilePath = 'tmp/docker-compose.yml';
const apiContainerName = 'slamby_api';
const apiSecretSetting = 'SlambyApi__ApiSecret';

process.env['COMPOSE_PROJECT_NAME'] = 'slamby';

app.get('/', function (req, res) {
    res.status(200).send("OK");
});

app.post('/', function (req, res) {
    var version = req.params['version']; 
    var client = github.client();
    
    var errorObj = { Errors: ["There was an error during the update process!"] };
    var responseObj = { Log: ""};

    var ghrelease = client.release('slamby/slamby-api', 'latest');
    ghrelease.info(function(err, release, headers) {
        if (err != null){
            console.error(err);
            res.status(500).json(errorObj);
        }
        for (var i = 0, len = release.assets.length; i < len; i++) {
            if (release.assets[i].name != "docker-compose-wu.yml") continue;
            var composeFileUrl = release.assets[i].browser_download_url;

            var composeStream = fs.createWriteStream(composeFilePath);
            request(composeFileUrl).pipe(composeStream);

            composeStream.on('close', function() {
                shell.exec(`docker exec ${apiContainerName} printenv ${apiSecretSetting}`, {silent:true}, function(code, stdout, stderr) {
                    if (code === 0) {
                        var secret = `Slamby ${stdout.trim()}`;
                        var requestSecret = req.get("Authorization");
                        if (requestSecret == secret) {
                            shell.exec(`docker-compose -f ${composeFilePath} up -d`, function(code, stdout, stderr) {
                                if (code === 0) {
                                    responseObj.Log = stderr;

                                    //delete the old images from the vm
                                    shell.exec('docker rmi $(docker images -q)');

                                    res.status(200).send(responseObj);
                                } else {
                                    console.error(stderr);
                                    errorObj.Errors.push(stderr);
                                    res.status(500).json(errorObj);
                                }
                            });
                        } else {
                            console.error("Authentication failed!");
                            res.status(401).send();
                        }
                    } else {
                        console.error(stderr);
                        errorObj.Errors.push("The problem can be that the Slamby API container is not running!");
                        res.status(500).json(errorObj);
                    }
                });
            });
        }
    });
});

app.listen(7000, function () {
  console.log('Slamby API updater app listening on port 7000!');
});