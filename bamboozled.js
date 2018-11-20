// bamboozled.js
//
// Name-guessing game using BambooHR API.
//
// Google auth:
//  https://medium.com/@jackrobertscott/how-to-use-google-auth-api-with-node-js-888304f7e3a0
//  https://cloud.google.com/nodejs/getting-started/authenticate-users
//  https://www.npmjs.com/package/passport-google-oauth2
//
// Available employee fields:
//  id: '12345'
//  displayName: 'Doe, Jane'
//  firstName: 'Jane'
//  lastName: 'Doe'
//  preferredName: null
//  gender: 'Female'
//  jobTitle: 'Senior Programmer'
//  workPhone: null
//  mobilePhone: '404-123-4567'
//  workEmail: 'jane.doe@work.com'
//  department: 'Technology'
//  location: 'Skunkworks'
//  division: 'ABC'
//  workPhoneExtension: null
//  photoUploaded: true
//  photoUrl: 'https://s3.ca-central-1.amazonaws.com/bamboohr-app-ca-central-1-production/images/1234/photos/12345-2-1.jpg'
//  canUploadPhoto: 0

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
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write("<body>");
    response.write(`Hello ${employee.firstName}!<br>`);
    response.write(`<img src="${employee.photoUrl}">`);
    response.write("</body>");
    response.end();
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
    // Omit leading slash from path.
    var requestPath = url.parse(request.url).pathname.substring(1);
    switch (requestPath)
    {
        case 'random':
            serveRandomEmployee(response);
            break;
        default:
            serveFile(requestPath, response);
    }
}

function startServer()
{
    http.createServer(serveRequest)
        .listen(config.port, config.hostname,
            function()
            {
                console.log(`Server running at http://${config.hostname}:${config.port}/`);
            });
}

getEmployeeDirectory();
startServer();
