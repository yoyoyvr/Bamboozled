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
- redis data store for employee directory
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

const bambooapi = require('bamboo');

// Global variables.
var bamboo = null;

function serveRandomEmployee(response)
{
    var r = Math.floor(Math.random() * bamboo.directory.length);
    var employee = bamboo.directory[r];
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data = { id: employee.id, img: employee.photoUrl };
    response.write(JSON.stringify(data));
    response.end();
}

function serveAnswerReply(response, query)
{
    var employee = findEmployee(query.id);
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data = { id: employee.id, name: employeeFullName(employee), correct: employeeNameMatches(employee, query.name) };
    response.write(JSON.stringify(data));
    response.end();
}

function findEmployee(id)
{
    for (var i = 0; i < bamboo.directory.length; i++)
    {
        var employee = bamboo.directory[i];
        if (employee.id == id)
            return employee;
    }
    
    return null;
}

function employeeNameMatches(employee, name)
{
    var upperName = name.toUpperCase();
    var matches =
        (upperName == employee.firstName.toUpperCase()) ||
        ((employee.preferredName != null) && (upperName == employee.preferredName.toUpperCase())) ||
        (upperName == employee.lastName.toUpperCase());
    return matches;
}

// TODO: this isn't working right
function employeeFullName(employee)
{
    return ((employee.preferredName != null) && (employee.preferredName != '')) ? (employee.preferredName + " " + employee.lastName) : (employee.firstName + " " + employee.lastName);
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

function startServer(hostname, port)
{
    http.createServer(serveRequest)
        .listen(port, //hostname,
            function()
            {
                console.log(`Server running at http://${hostname}:${port}/`);
            });
}

function main()
{
    const config = JSON.parse(fs.readFileSync('.config', 'utf8'));
    bamboo = new bambooapi.Bamboo(config.bamboo);
    bamboo.getDirectory()

    startServer(config.hostname, config.port);
}

main();
