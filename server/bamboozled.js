/*
==Bamboozled==

Name-guessing game using BambooHR API.

TODO:
- question and answer client/server flow
- don't crash!!
- persistent session on server (in memory to start)
- Google auth (Blackbird only, and so we know which employee is playing)
- improved UI on client (React?)
- redis data store for employee directory
- user bio feature (stored in redis)
- relationship strength table (MySQL; record correct guesses, number of attempts, etc.)
- incorrect guesses table
- name and logo (Bamboom? Bamboozled? BimBamboo?)
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

/*
Available employee fields (from Bamboo):
 id: '12345'
 displayName: 'Doe, Jane'
 firstName: 'Jane'
 lastName: 'Doe'
 preferredName: null
 gender: 'Female'
 jobTitle: 'Senior Programmer'
 workPhone: null
 mobilePhone: '404-123-4567'
 workEmail: 'jane.doe@work.com'
 department: 'Technology'
 location: 'Skunkworks'
 division: 'ABC'
 workPhoneExtension: null
 photoUploaded: true
 photoUrl: 'https://s3.ca-central-1.amazonaws.com/bamboohr-app-ca-central-1-production/images/1234/photos/12345-2-1.jpg'
 canUploadPhoto: 0
*/

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Global variables.
const config = JSON.parse(fs.readFileSync('.config', 'utf8'));
var employeeDirectory = null;

function onEmployeeDirectoryResponse(response)
{
      response.setEncoding('utf8');
      var body = "";
      response.on('data', function (chunk)
      {
          body += chunk;
      }).on('end', function()
      {
        employeeDirectory = JSON.parse(body)['employees'];
      });
      response.on('error', console.error);
}

function getEmployeeDirectory()
{
    var options = {
      host: 'api.bamboohr.com',
      method: 'GET',
      path: '/api/gateway.php/' + config.bambooOrganization + '/v1/employees/directory',
      auth: config.apikey + ':x',
      headers: {Accept: 'application/json'}
    };
    var req = https.request(options, onEmployeeDirectoryResponse).end();
}

function serveRandomEmployee(response)
{
    var r = Math.floor(Math.random() * employeeDirectory.length);
    var employee = employeeDirectory[r];
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
    for (var i = 0; i < employeeDirectory.length; i++)
    {
        var employee = employeeDirectory[i];
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
        (upperName == employee.preferredName.toUpperCase()) ||
        (upperName == employee.lastName.toUpperCase());
    return matches;
}

// TODO: this isn't working right
function employeeFullName(employee)
{
    return (employee.preferredName != null) ? (employee.preferredName + " " + employee.lastName) : (employee.firstName + " " + employee.lastName);
}

function serveFile(requestPath, response)
{
    console.log("serving " + requestPath);
        
    const clientRoot = "client";
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

function startServer()
{
    http.createServer(serveRequest)
        .listen(config.port, //config.hostname,
            function()
            {
                console.log(`Server running at http://${config.hostname}:${config.port}/`);
            });
}

getEmployeeDirectory();
startServer();
