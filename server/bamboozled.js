/*
==Bamboozled==

Name-guessing game using BambooHR API.

TODO:
- question and answer client/server flow
- don't crash!!
- persistent session on server (in memory to start)
- Google auth (Blackbird only, and so we know which employee is playing)
- improved UI on client (React?)
- bamboozled name & logo title screen
- improved name matching - bonus points for getting first and last?
- redis data store for employee directory (cache previous server run, in case of Bamboo API error)
- user bio feature (stored in redis)
- relationship strength table (MySQL; record correct guesses, number of attempts, etc.)
- incorrect guesses table
*/

/*
Q&A flow (simple initial version):

These may help (install Request package?):
https://nodejs.org/docs/latest/api/http.html#http_class_http_clientrequest
https://www.twilio.com/blog/2017/08/http-requests-in-node-js.html

    CLIENT                      SERVER
    access main page
                                serve main page
    TODO: configure mode options
    click [start]
    submit start request
                                receive start request
                                create session
                                store session
                                create quiz
                                serve first question
    display question
    receive client input
    submit answer
                                receive answer
                                retrieve session info (current question)
                                validate answer
                                store result
                                serve response (correct/incorrect)
                                TODO: hints, try again, etc.
    display response
    click [continue]
    submit continue request
                                receive continue request
                                retrieve session info
                                serve next question
    <repeat from above>
                                OR serve quiz summary
    display summary
*/

/*
 Google auth:
  https://medium.com/@jackrobertscott/how-to-use-google-auth-api-with-node-js-888304f7e3a0
  https://cloud.google.com/nodejs/getting-started/authenticate-users
  https://www.npmjs.com/package/passport-google-oauth2
*/

// Allow modules to be loaded from the current folder.
module.paths.push('.');

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const Bamboo = require('bamboo/Bamboo');

// Global variables.
var bamboo = null;

function startServer(hostname, port)
{
    http.createServer(serveRequest)
        .listen(port, //hostname,
            function()
            {
                console.log(`server running at http://${hostname}:${port}/`);
            });
}

function serveRequest(request, response)
{
    var urlparts = url.parse(request.url, true);
    var requestPath = urlparts.pathname.substring(1);   // omit leading slash
    switch (requestPath)
    {
        case '':
            serveFile("index.html", response);
            break;
        case 'random':
            serveRandomEmployee(response);
            break;
        case 'answer':
            serveAnswerReply(response, urlparts.query);
            break;
        default:
            serveFile(requestPath, response);
    }
}

function serveRandomEmployee(response)
{
    var employee = bamboo.getRandomEmployee();
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data = { id: employee.id, img: employee.photoUrl };
    response.write(JSON.stringify(data));
    response.end();
}

function serveAnswerReply(response, query)
{
    var employee = bamboo.findEmployee(query.id);
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data = { id: employee.id, img: employee.photoUrl, name: employee.fullName, correct: employee.nameMatches(query.name) };
    response.write(JSON.stringify(data));
    response.end();
}

function serveFile(requestPath, response)
{
    console.log("serving " + requestPath);
        
    const clientRoot = path.join(path.dirname(__dirname), "client");
    
    if (requestPath == "")
    {
        requestPath = "index.html";
    }
    var clientPath = path.join(clientRoot, requestPath);
    if (fs.existsSync(clientPath))
    {
        response.statusCode = 200;
        fs.createReadStream(clientPath).pipe(response)
        console.log("served " + clientPath);
    }
    else
    {
        response.statusCode = 404;
        response.end("Sorry, couldn't find " + requestPath);
        console.log("error serving " + clientPath);
    }
}

function main()
{
    const config = JSON.parse(fs.readFileSync('.config', 'utf8'));
    bamboo = new Bamboo(config.bamboo);
    startServer(config.hostname, config.port);
}

main();
