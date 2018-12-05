/*
==Bamboozled==

Name-guessing game using BambooHR API.

TODO:
- question and answer client/server flow
- don't crash!!
- persistent session on server (in memory to start)
- Google auth
    - https://www.npmjs.com/package/google-auth-library
    - create app at Google Developer console - https://console.developers.google.com
    - created bamboozled-604 under blackbirdinteractive organization, using my BBI google account
    - or can it all be client side? https://developers.google.com/identity/sign-in/web/sign-in
    - Blackbird only, and so we know which employee is playing
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

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const {OAuth2Client} = require('google-auth-library');

const Bamboo = require('./bamboo/Bamboo');

// App secrets in .config.json, not submitted to version control.
const config = require('./.config.json');

// OAuth2 configuration downloaded from the Google Developer Console
const authKeys = require('./.config.oauth2.json');

// Global variables.
const bamboo = new Bamboo(config.bamboo);
const authClient = new OAuth2Client(authKeys.web.client_id);

var sessionCount = 0;
var sessions = {};


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

    console.log(`${request.method}: ${requestPath}`);
    if (request.method === 'POST')
    {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            body = querystring.parse(body);
            serveParsedRequest(requestPath, urlparts, body, response);
        });
    }
    else
    {
        serveParsedRequest(requestPath, urlparts, null, response);
    }
}

function serveParsedRequest(requestPath, urlparts, body, response)
{
    switch (requestPath)
    {
        case '':
            serveFile("index.html", response);
            break;
        case 'connect':
            createPlaySession(body.idtoken, response);
            break;
        case 'play':
            startPlaySession(urlparts.query, response);
            break;
        case 'continue':
            continuePlaySession(urlparts.query, response);
            break;
        case 'random':
            serveRandomEmployee(urlparts.query, response);
            break;
        case 'answer':
            serveAnswerReply(urlparts.query, response);
            break;
        default:
            serveFile(requestPath, response);
    }
}

function createPlaySession(idtoken, response)
{
    // validate google ID token and get user info
    validateIDToken(idtoken)
    .catch(e =>
    {
        console.log(e);
    })
    .then(userinfo =>
    {
        // NOTE: we'll get here after catching an exception with userinfo undefined
        console.log("USERINFO: " + JSON.stringify(userinfo));
    });
    
    var sessionID = (++sessionCount << 10) + Math.floor(Math.random() * 1024);
    sessions[sessionID] =
    {
        id: sessionID,
        employeeIDs: shuffle(bamboo.getEmployeeIDs()).slice(0,10),  // TODO: decide on game length
        index: 0,
        right: 0,
        wrong: 0
    };
}

function startPlaySession(query, response)
{
    // TODO: anything special to do on start of play session?
    continuePlaySession(query, response);
}

function continuePlaySession(query, response)
{
    // TODO: error handling if session no longer exists
    var session = sessions[query.id];
    if (session.index < session.employeeIDs.length)
    {
        var employee = bamboo.findEmployee(session.employeeIDs[session.index]);
        response.writeHead(200, {'Content-Type': 'application/json'});
        var data =
        {
            id: sessionID,
            img: employee.photoUrl,
            total: session.employeeIDs.length,
            right: session.right,
            wrong: session.wrong
        };
        response.write(JSON.stringify(data));
        response.end();
    }
    else
    {
        // TODO: tell user their score - or handle this on client
    }
}

// From https://stackoverflow.com/a/6274381/503688
// https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle#The_modern_algorithm
function shuffle(a)
{
    var j, x, i;
    for (i = a.length - 1; i > 0; i--)
    {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

// TODO: bring back random functionality (just needs client I think)
function serveRandomEmployee(query, response)
{
    var employee = bamboo.getRandomEmployee();
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data = { id: employee.id, img: employee.photoUrl };
    response.write(JSON.stringify(data));
    response.end();
}

function serveAnswerReply(query, response)
{
    var session = sessions[query.id];
    var employee = bamboo.findEmployee(session.employeeIDs[session.index++]);
    var correct = employee.nameMatches(query.name);
    if (correct)
    {
        session.right++;
    }
    else
    {
        session.wrong++;
    }
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data =
    {
        id: session.id,
        img: employee.photoUrl,
        name: employee.fullName,
        correct: correct,
        total: session.employeeIDs.length,
        right: session.right,
        wrong: session.wrong
    };
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

async function validateIDToken(idtoken)
{
    const ticket = await authClient.verifyIdToken({
        idToken: idtoken,
        audience: authKeys.web.client_id,
    });

    var payload = ticket.getPayload();
    
    // Validate domain.
    if (payload.hd == config.domain)
    {
        throw new Error(`invalid domain ${payload.hd}; expected ${config.domain}`);
    }

    console.log("PAYLOAD: " + JSON.stringify(payload));
    return payload;
}

function main()
{
    startServer(config.hostname, config.port);
}

main();
