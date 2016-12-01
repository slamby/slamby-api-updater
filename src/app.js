var express = require('express');
var app = express();
var github = require('octonode');
var request = require('request');
var fs = require('fs');
var shell = require('shelljs');
var YAML = require('yamljs');

const composeFilePath = 'tmp/docker-compose.yml';
const apiContainerName = 'slamby_api';
const apiEnvVarPrefix = 'SlambyApi';
var inProgress = false;

process.env['COMPOSE_PROJECT_NAME'] = 'slamby';

app.get('/', function (req, res) {
    res.status(200).send("OK");   
});

app.post('/', function (req, res) {
    var errorObj = { Errors: ["There was an error during the update process!"] };
    if (inProgress) {
        errorObj.Errors.push("Update in progress!");
        res.status(500).json(errorObj);
        return;
    }
    
    try {
        inProgress = true;
        console.log('Party is starting here!');
        var client = github.client();
    
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
                
                console.log(`Compose file found, the URL is: ${composeFileUrl}`);

                var composeStream = fs.createWriteStream(composeFilePath);
                request(composeFileUrl).pipe(composeStream);

                composeStream.on('close', function() {
                    var nativeObject = YAML.load(composeFilePath);

                    console.log(`Compose file loaded..`);

                    shell.exec(`docker inspect ${apiContainerName}`, {silent:true}, function(code, stdout, stderr) {
                        if (code === 0) {
                            var inspectObj = JSON.parse(stdout);
                            if (inspectObj[0].Config.Env.length > 0){
                                if (nativeObject.services.slambyapi["environment"] == undefined) nativeObject.services.slambyapi["environment"] = {};
                                inspectObj[0].Config.Env.forEach(function(envVar) {
                                    if (envVar.startsWith(apiEnvVarPrefix)){
                                        var splitted = envVar.split("=");
                                        nativeObject.services.slambyapi["environment"][splitted[0]] = splitted[1];
                                        console.log(`Environment variable was added to the compose file: ${envVar}`);
                                    }
                                }, this);
                            }
                            fs.writeFileSync(composeFilePath, YAML.stringify(nativeObject, 4));
                            shell.exec(`docker-compose -f ${composeFilePath} up -d`, function(code, stdout, stderr) {
                                console.log(`Composing finished`);
                                if (code === 0) {
                                    responseObj.Log = stderr;

                                    console.log(`Delete old images...`);
                                    //delete the old images from the vm
                                    shell.exec('docker rmi $(docker images -q)');
                                    
                                    inProgress = false;
                                    res.status(200).send(responseObj);
                                } else {
                                    inProgress = false;
                                    console.error(stderr);
                                    errorObj.Errors.push(stderr);
                                    res.status(500).json(errorObj);
                                }
                            });
                        } else {
                            inProgress = false;
                            console.error(stderr);
                            errorObj.Errors.push("The problem can be that the Slamby API container is not running!");
                            res.status(500).json(errorObj);
                        }
                    });
                });
            }
        });
    }
    catch (err){
        res.status(500).json(errorObj);
        inProgress = false;
    }

});

app.listen(7000, function () {
  console.log('Slamby API updater app listening on port 7000!');
});