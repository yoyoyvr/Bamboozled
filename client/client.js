// Globals.
var googleProfile;
var googleIDToken;

// https://developers.google.com/identity/sign-in/web/reference

function onLoad()
{
    //showMainMenu();
}

function showMainMenu()
{
    var name = googleProfile.getName();
    document.getElementById("main").innerHTML =
        `
        <div class="salutation">Hi ${name}!!</div>
        <form id="gameModeForm">
            <label>Game Length</label>
            <input type="radio" class="form-radio" name="gameLength" value="10" checked> 10
            <input type="radio" class="form-radio" name="gameLength" value="20"> 20
            <input type="radio" class="form-radio" name="gameLength" value="50"> 50
            <input type="radio" class="form-radio" name="gameLength" value="everyone"> Everyone<br><br>
            <label>Difficulty</label>
            <input type="radio" class="form-radio" name="gameMode" value="normal" checked> Normal
            <input type="radio" class="form-radio" name="gameMode" value="beast"> Beast Mode<br>
        </form>
        <button id="startButton" class="button playButton" onclick="startSession()">PLAY</button>
        <button class="button continueButton" onclick="showLeaderboard()">LEADERBOARD</button>
        `;
    document.getElementById("startButton").focus();
}

function onSignIn(googleUser)
{
    googleProfile = googleUser.getBasicProfile();
    googleIDToken = googleUser.getAuthResponse().id_token;

    showMainMenu();

    //console.log('ID: ' + googleProfile.getId()); // Do not send to your backend! Use an ID token instead. (see below)
    //console.log('Name: ' + googleProfile.getName());
    //console.log('Image URL: ' + googleProfile.getImageUrl());
    //console.log('Email: ' + googleProfile.getEmail()); // This is null if the 'email' scope is not present.
}

function onSignInError(error)
{
    console.log(error);
}

function signOut()
{
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
    });
}

function showLeaderboard(gameLength, gameMode)
{
    if (!gameLength)
    {
        gameLength = document.querySelector('input[name="gameLength"]:checked').value;
    }
    if (!gameMode)
    {
        gameMode = document.querySelector('input[name="gameMode"]:checked').value;
    }

    var url = buildUrl('leaderboard', {length: gameLength, mode: gameMode});
    var request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function() { 
        if (request.readyState == 4 && request.status == 200)
            onLeaderboard(request.responseText, gameLength, gameMode);
        else
            onError(request.statusText)
    }
    request.send('idtoken=' + googleIDToken);
}

function onLeaderboard(responseText, gameLength, gameMode)
{
    var data = JSON.parse(responseText);
    var mainElement = document.getElementById("main");

    var title = document.createElement('div');
    title.className = "leaderboardTitle";
    title.innerHTML = `${formatGameLength(gameLength)}${formatGameMode(gameMode)}`;
    
    var table = document.createElement('table');
    table.className = "leaderboard";
    
    var header = document.createElement('tr');
    for (var text of ["Rank", "Name", "Score", "Time", "Date"])
    {
        var cell = document.createElement('th');
        cell.textContent = text;
        header.appendChild(cell);
    }
    table.appendChild(header);
    
    var rank = 0;
    for (var result of data.leaderboard)
    {
        rank++;
        var position = rank.toString();
        var name = result.employee_name;
        var score = result.score;
        var duration = formatDuration(result.duration);
        var date = formatTimestamp(result.timestamp);
        
        var row = document.createElement('tr');
        row.className = (rank%2 == 1 ? "odd" : "even") + (result.employee_id == data.id ? " self" : "");
        for (var text of [position, name, score, duration, date])
        {
            var cell = document.createElement('td');
            cell.textContent = text;
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    
    var button = document.createElement('div');
    button.innerHTML = `<br><br><input type="submit" class="button continueButton" onclick="showMainMenu()" value="CONTINUE"></input>`;
    
    while (mainElement.lastChild)
    {
        mainElement.removeChild(mainElement.lastChild);
    }
    mainElement.appendChild(title);
    mainElement.appendChild(table);
    mainElement.appendChild(button);
}

function startSession()
{
    var gameLength = document.querySelector('input[name="gameLength"]:checked').value;
    var gameMode = document.querySelector('input[name="gameMode"]:checked').value;

    // Send our ID token to the server along with the request to start a game.
    var url = buildUrl('play', {length: gameLength, mode: gameMode});
    var request = new XMLHttpRequest();
    request.open('POST', url);
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    request.onreadystatechange = function() { 
        if (request.readyState == 4 && request.status == 200)
            onNewQuestion(request.responseText);
        else
            onError(request.statusText)
    }
    request.send('idtoken=' + googleIDToken);
}

function continueSession(id)
{
    var url = buildUrl('continue', {id: id});
    httpGet(url, onNewQuestion, onError);
}

function onNewQuestion(responseText)
{
    var question = JSON.parse(responseText);
    var scoreText = getScoreText(question);
    var mainElement = document.getElementById("main");
    
    var imageElement = document.createElement('img');
    imageElement.width = 300;
    imageElement.height = 300;
    imageElement.src = question.img;

    var questionElement = document.createElement('div');
    questionElement.id = 'questionDiv';
    questionElement.innerHTML =
        `<div class="question">
            <form id="answerForm">
                Who's this? <input id="nameText" type="text" name="name" onkeydown="onEnterSubmitAnswer(event)" autofocus><br>
                <input type="hidden" name="id" value="${question.id}">
            </form>
        </div>
        ${scoreText}
        <br><br><input type="submit" class="button continueButton" onclick="onSubmitAnswer()" value="SUBMIT"></input>`;
    
    // Apparently clearing and explicitly adding elements is faster than setting innerHTML. I suppose I should do this everywhere.
    while (mainElement.lastChild)
    {
        mainElement.removeChild(mainElement.lastChild);
    }
    mainElement.appendChild(imageElement);
    mainElement.appendChild(questionElement);
    
    document.getElementById("nameText").focus();
}

function onEnterSubmitAnswer(e)
{
    if (e.keyCode == 13)
    {
        e.preventDefault();
        onSubmitAnswer();
    }
}

function onSubmitAnswer()
{
    var form = new FormData(document.forms.answerForm);
    var id = form.get('id');
    var name = form.get('name');
    
    var url = buildUrl('answer', {id: id, name: name});
    httpGet(url, onAnswerResponse, onError);
}

function onAnswerResponse(responseText)
{
    var response = JSON.parse(responseText);
    
    var resultText = (response.correct
        ? `<div class="correct">Yes, it's ${response.name}!!</div>`
        : `<div class="incorrect">No, it's ${response.name}!!</div>`);
    var scoreText = getScoreText(response);
    var moreToCome = (response.right + response.wrong < response.total);
    var continueText = (moreToCome
        ? `<br><br><input id="nextButton" type="submit" class="button continueButton" onclick="continueSession(${response.id})" value="NEXT"></input>`
        : `<br><br>
           <input id="againButton" type="button" class="button playButton" onclick="showMainMenu()" value="PLAY AGAIN"></input>
           <button class="button continueButton" onclick="showLeaderboard('`+response.length+`','`+response.mode+`')">LEADERBOARD</button>
          `);
    
    document.getElementById("questionDiv").innerHTML =
        resultText
        + scoreText
        + continueText;
    
    // Don't put focus on the "againButton" because it's too easy to start a new game without realizing it.
    if (moreToCome)
    {
        document.getElementById("nextButton").focus();
    }
}

function getScoreText(response)
{
    var right = response.right;
    var wrong = response.wrong;
    var total = response.total;
    var sofar = right + wrong;
    var remaining = total - sofar;
    
    var gameMode = formatGameMode(response.mode);
    var scoreText = null;
    if (remaining > 0)
    {
        scoreText = `<div class="score">${right}/${sofar} correct, ${remaining} to go${gameMode}</div>`;
    }
    else
    {
        scoreText = `<div class="score finalScore">You got ${right}/${sofar} correct!${gameMode}</div>`;
    }
    
    return scoreText;
}

function formatGameLength(length)
{
    switch (length)
    {
        case "everyone":
        case 0:
            return "Everyone";
        
        default:
            return "Game Length " + length;
    }
}

function formatGameMode(mode)
{
    return (mode == "beast" ? '   <span class="beastMode">Beast Mode</span>' : '');
}

function formatDuration(seconds)
{
    var h = Math.floor(seconds / 3600);
    seconds %= 3600;
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    
    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function formatTimestamp(timestamp)
{
    var date = new Date(timestamp * 1000);
    var options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('en', options);
}

function onError(statusText)
{
    // TODO: why does onError get called with non-errors?
    if ((statusText != "") && (statusText != "OK"))
    {
        document.getElementById("main").innerHTML = statusText;
    }
}

function buildUrl(path, params)
{
    var url = window.location.href;
    
    // Strip trailing hash mark if present, and ensure ends with slash.
    if (url.endsWith('#'))
    {
        url = url.slice(0, -1);
    }
    if (!url.endsWith('/'))
    {
        url += '/';
    }

    // Add path and parameters.
    url = url + path;
    if (params)
    {
        var first = true;
        for (var key in params)
        {
            url += (first ? '?' : '&');
            first = false;
            url += `${key}=${params[key]}`;
        }
    }
    
    return url;
}

// TODO: put this in a module and make it a class that somewhat emulates the nodejs http.request mechanism
// or use 'request' library https://github.com/request/request
function httpGet(theUrl, onResponse, onError)
{
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() { 
        if (request.readyState == 4 && request.status == 200)
            onResponse(request.responseText);
        else
            onError(request.statusText)
    }
    request.open("GET", theUrl, true); // true for asynchronous 
    request.send(null);
}
