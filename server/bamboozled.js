/*
==Bamboozled==

Name-guessing game using BambooHR API.

https://trello.com/b/kdW6gonu/bamboozled
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
  
  - https://www.npmjs.com/package/google-auth-library
  - create app at Google Developer console - https://console.developers.google.com
  - created bamboozled-604 under blackbirdinteractive organization, using my BBI google account
  - or can it all be client side? https://developers.google.com/identity/sign-in/web/sign-in
  - Blackbird only, and so we know which employee is playing
*/

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const mysql = require('mysql');

// Note: need to "npm install google-auth-library"
//     + google-auth-library@2.0.1
//     added 29 packages from 32 contributors and audited 50 packages
// So many dependencies!!
const {OAuth2Client} = require('google-auth-library');

const Bamboo = require('./bamboo/Bamboo');

// App secrets in .config.json, not submitted to version control.
const config = require('./.config.json');

// OAuth2 configuration downloaded from the Google Developer Console
const authKeys = require('./.config.oauth2.json');

// Global variables.
const bamboo = new Bamboo(config.bamboo);
const authClient = new OAuth2Client(authKeys.web.client_id);
fs.existsSync("./logs") || fs.mkdirSync("./logs");
const guessLog = fs.createWriteStream("./logs/guesses.log", {flags:'a'});

var sessionCount = 0;
var sessions = {};
var database = null;

function connectToDatabase(config)
{
    var db = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database,
      insecureAuth : true
    });

    db.connect(function(err)
    {
        if (err)
        {
            logError(err);
            return;
        }
        console.log(`connected to database ${config.host} as ${config.user}`);
    });    
    
    return db;
}

function startHttpServer(hostname, port = 80)
{
    http.createServer(tryServeRequest)
        .listen(port, //hostname,
        function()
        {
            console.log(`server running at http://${hostname}:${port}/`);
        });
}

function startHttpsServer(hostname, port = 443)
{
    const options = {
        key: fs.readFileSync('./bbi.com-key.pem'),
        cert: fs.readFileSync('./bbi.com-cert.pem'),
        ca: fs.readFileSync('./bbi.com-inter.pem')
    };
    https.createServer(options, tryServeRequest)
        .listen(port, //hostname,
        function()
        {
            console.log(`server running at https://${hostname}:${port}/`);
        });
}

function tryServeRequest(request, response)
{
    try
    {
        serveRequest(request, response);
    }
    catch (error)
    {
        console.error(error);
        
        response.writeHead(404, {'Content-Type': 'application/json'});
        response.write(`{"error": "${error.message}"}`);
        response.end();
    }
}

function serveRequest(request, response)
{
    var urlparts = url.parse(request.url, true);
    var requestPath = urlparts.pathname.substring(1);   // omit leading slash

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
        case 'play':
            createPlaySession(body.idtoken, urlparts.query.length, urlparts.query.mode, response);
            break;
        case 'continue':
            continuePlaySession(urlparts.query.id, response);
            break;
        case 'random':
            serveRandomEmployee(urlparts.query, response);
            break;
        case 'answer':
            serveAnswerReply(urlparts.query, response);
            break;
        case 'leaderboard':
            serveLeaderboard(body.idtoken, urlparts.query.length, urlparts.query.mode, response);
            break;
        default:
            serveFile(requestPath, response);
    }
}

// Intercept http and redirect to https.
// Allows clients to connect via bare URL bamboozled.blackbirdinteractive.com.
function startHttpRedirectServer(hostname, port = 80)
{
    http.createServer(tryRedirectRequest)
        .listen(port, //hostname,
        function()
        {
            console.log(`redirect server running at http://${hostname}:${port}/`);
        });
}

function tryRedirectRequest(request, response)
{
    try
    {
        var redirect = "https://" + request.headers.host + request.url;
        response.redirect(redirect);
        logDebug(`redirecting http request to ${redirect}`);
    }
    catch (error)
    {
        console.error(error);
        
        response.writeHead(404, {'Content-Type': 'application/json'});
        response.write(`{"error": "${error.message}"}`);
        response.end();
    }
}

function createPlaySession(idtoken, gameLength, gameMode, response)
{
    // validate google ID token and get user info
    validateIDToken(idtoken)
    .catch(e =>
    {
        console.log(e);
    })
    .then(userinfo =>
    {
        // if there was an exception we still get here, so need to handle undefined user info
        if (userinfo)
        {
            var employee = bamboo.findEmployeeByEmail(userinfo.email);
            var session = findSession(employee, gameLength, gameMode);
            if (!session)
            {
                session = createSession(employee, gameLength, gameMode);
            }
            
            continuePlaySession(session.id, response);
        }
    });
}

function getSession(sessionid, response)
{
    var session = sessions[sessionid];
    if (!session)
    {
        console.log(`SESSION NOT FOUND: ${sessionid}`);
        
        // TODO: error handling on client if session no longer exists
        response.writeHead(404, {'Content-Type': 'application/json'});
        response.write('{"error": "session not found"}');
        response.end();
    }
    
    return session;
}

function findSession(employee, gameLength, gameMode)
{
    // TODO: finish implementation of resuming existing sessions (see https://trello.com/c/FGI2XZ1I/17-tidy-up-session-management)
    return null;
    
    for (var key in sessions)
    {
        var session = sessions[key];
        if (session.user == employee.id)
        {
            return session;
        }
    }
    
    return null;
}

function createSession(employee, gameLength, gameMode)
{
    // TODO: decide how to generate session ID's to avoid clients spoofing sessions - for now it's an increasing count, plus a random number
    var sessionid = (++sessionCount << 10) + Math.floor(Math.random() * 1024);
    console.log(`creating session ${sessionid} for ${employee.fullName}`);
    var numberQuestions = (gameLength == "everyone" ? bamboo.directory.length : parseInt(gameLength));
    var session =
    {
        id: sessionid,
        user: employee.id,
        username: employee.fullPreferredName,
        employeeIDs: bamboo.getRandomEmployeeIDs(numberQuestions),
        index: 0,
        right: 0,
        wrong: 0,
        mode: gameMode,
        length: (gameLength == "everyone" ? 0 : numberQuestions),
        starttime: getTimestamp()
    };
    
    sessions[sessionid] = session;
    
    return session;
}

function continuePlaySession(sessionid, response)
{
    var session = getSession(sessionid, response);
    if (!session)
        return;
    if (!isSessionOver(session))
    {
        var employee = bamboo.getEmployee(session.employeeIDs[session.index]);
        response.writeHead(200, {'Content-Type': 'application/json'});
        var data =
        {
            id: sessionid,
            img: employee.photoUrl,
            total: session.employeeIDs.length,
            right: session.right,
            wrong: session.wrong,
            mode: session.mode
        };
        response.write(JSON.stringify(data));
        response.end();
    }
    else
    {
        // TODO: do we ever get here?
        logError(`error: failed to continue play session`);
    }
}

function isSessionOver(session)
{
    return (session.index >= session.employeeIDs.length);
}

function reportSessionScore(session)
{
    var employee_id = session.user;
    var employee_name = session.username;
    
    if (config.banned && config.banned.includes(employee_id))
    {
        logError(`ignoring score from banned player ${employee_name}`)
        return;
    }
    
    var timestamp = getTimestamp();
    var duration = timestamp - session.starttime;
    var score = session.right;
    var game_mode = session.mode;
    var game_length = session.length;

    var sqlSelect = `SELECT * FROM scores WHERE employee_id = ${employee_id} AND game_mode = '${game_mode}' AND game_length = '${game_length}'`;
    database.query(sqlSelect, function (err, result) {
        if (err)
        {
            logError(err);
            return;
        }
        
        var sqlUpdateOrInsert = null;
        if (result.length > 0)
        {
            if ((result[0].score < score) || ((result[0].score == score) && (result[0].duration > duration)))
            {
                sqlUpdateOrInsert = `UPDATE scores SET score = ${score}, timestamp = ${timestamp}, duration = ${duration} WHERE employee_id = ${employee_id} AND game_mode = '${game_mode}' AND game_length = '${game_length}'`;                
            }
        }
        else
        {
            sqlUpdateOrInsert = `INSERT INTO scores (employee_id, employee_name, timestamp, duration, score, game_length, game_mode) VALUES ('${employee_id}', '${employee_name}', '${timestamp}', '${duration}', '${score}', '${game_length}', '${game_mode}')`;
        }
        
        if (sqlUpdateOrInsert != null)
        {
            database.query(sqlUpdateOrInsert, function (err, result) {
                if (err)
                {
                    logError(err);
                    return;
                }
            });
        }
    });
}

function getLeaderboard(gameLength, gameMode, callback)
{
    var game_length = (gameLength == "everyone" ? 0 : parseInt(gameLength));
    var game_mode = gameMode;
    database.query(`SELECT * FROM scores WHERE game_length=${game_length} AND game_mode='${game_mode}' ORDER BY score DESC, duration ASC`, function (err, result) {
        if (err)
        {
            logError(err);
            return;
        }
        callback(result);
    });
}

function serveLeaderboard(idtoken, gameLength, gameMode, response)
{
    // validate google ID token and get user info (so we can highlight current user in returned results)
    validateIDToken(idtoken)
    .catch(e =>
    {
        console.log(e);
    })
    .then(userinfo =>
    {
        // if there was an exception we still get here, so need to handle undefined user info
        if (userinfo)
        {
            var employee = bamboo.findEmployeeByEmail(userinfo.email);
            
            var data = getLeaderboard(gameLength, gameMode, function(data) {
                response.write(JSON.stringify({id: employee.id, leaderboard: data}));
                response.end();
            });
        }
    });
}

function getTimestamp()
{
    return Math.floor(Date.now() / 1000);
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
    var session = getSession(query.id, response);
    if (!session)
        return;
    
    var employee = bamboo.getEmployee(session.employeeIDs[session.index]);
    var correct = (session.mode == "beast" ? employee.fullNameMatches(query.name) : employee.nameMatches(query.name));
    
    logGuess(session.user, session.employeeIDs[session.index], query.name, correct);
    
    session.index++;
    if (correct)
    {
        session.right++;
    }
    else
    {
        session.wrong++;
    }
    
    if (isSessionOver(session))
    {
        reportSessionScore(session);
    }
    
    response.writeHead(200, {'Content-Type': 'application/json'});
    var data =
    {
        id: session.id,
        img: employee.photoUrl,
        name: (session.mode == "beast" ? employee.fullName : employee.fullPreferredName),
        correct: correct,
        total: session.employeeIDs.length,
        right: session.right,
        wrong: session.wrong,
        mode: session.mode,
        length: session.length
    };
    response.write(JSON.stringify(data));
    response.end();
    
    if (isSessionOver(session))
    {
        delete sessions[session.id];
    }
}

function logGuess(guesserid, guessingid, guess, correct)
{
    const timestamp = getTimestamp();
    
    // Avoid any sort of SQL injection, and truncate to length of column.
    guess = purifyString(guess).substring(0,45);
    
    var sql = `INSERT INTO guesses (timestamp, employee_id, guessing_id, guess, correct) VALUES ('${timestamp}', '${guesserid}', '${guessingid}', '${guess}', ${correct ? 1 : 0})`;
    database.query(sql, function (err, result) {
        if (err)
        {
            logError(err);
            return;
        }
    });
}

function purifyString(s)
{
    return s.replace(/[^a-zA-Z0-9 ]/g, '');
}


function serveFile(requestPath, response)
{
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
    }
    else
    {
        response.statusCode = 404;
        response.end("Sorry, couldn't find " + requestPath);
        console.log("error serving " + clientPath);
    }
}

// for more info, see https://developers.google.com/identity/sign-in/web/backend-auth (includes nodejs guidance)
async function validateIDToken(idtoken)
{
    const ticket = await authClient.verifyIdToken({
        idToken: idtoken,
        audience: authKeys.web.client_id,
    });

    var payload = ticket.getPayload();
    
    // Validate domain.
    if (payload.hd != config.domain)
    {
        throw new Error(`invalid domain ${payload.hd}; expected ${config.domain}`);
    }

    return payload;
}

function logError(err)
{
    console.log(err);
}

function logDebug(msg)
{
    if (config.debug)
    {
        console.log(err);
    }
}

function main()
{
    database = connectToDatabase(config.mysql);
    startHttpRedirectServer(config.hostname, 3000);
    startHttpsServer(config.hostname, config.port);
}

main();
