// Globals.
var googleProfile;
var googleIDToken;

// https://developers.google.com/identity/sign-in/web/reference

function onLoad()
{
    //showPlayButton();
}

function showPlayButton()
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
        `;
    document.getElementById("startButton").focus();
}

function onSignIn(googleUser)
{
    googleProfile = googleUser.getBasicProfile();
    googleIDToken = googleUser.getAuthResponse().id_token;

    showPlayButton();

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

function startSession()
{
    var gameLength = document.querySelector('input[name="gameLength"]:checked').value;
    var gameMode = document.querySelector('input[name="gameMode"]:checked').value;

    // Send our ID token to the server along with the request to start a game.
    // TODO: should this be https?
    var url = window.location + `play?length=${gameLength}&mode=${gameMode}`;
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
    var url = window.location + `continue?id=${id}`;
    httpGet(url, onNewQuestion, onError);
}

function onNewQuestion(responseText)
{
    var question = JSON.parse(responseText);
    var scoreText = getScoreText(question);
    var mainElement = document.getElementById("main");
    
    // Apparently clearing and explicitly adding elements is faster than setting innerHTML. I suppose I should do this everywhere.
    while (mainElement.lastChild) {
        mainElement.removeChild(mainElement.lastChild);
    }

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
    
    var url = window.location + `answer?id=${id}&name=${name}`;
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
        : `<br><br><input id="againButton" type="button" class="button playButton" onclick="showPlayButton()" value="PLAY AGAIN"></input>`);
    
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
    
    var beastMode = (response.mode == "beast" ? `   <span class="beastMode">Beast Mode</span>` : "");
    var scoreText = null;
    if (remaining > 0)
    {
        scoreText = `<div class="score">${right}/${sofar} correct, ${remaining} to go${beastMode}</div>`;
    }
    else
    {
        scoreText = `<div class="score finalScore">You got ${right}/${sofar} correct!${beastMode}</div>`;
    }
    
    return scoreText;
}

function onError(statusText)
{
    // TODO: why does onError get called with non-errors?
    if ((statusText != "") && (statusText != "OK"))
    {
        document.getElementById("main").innerHTML = statusText;
    }
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
