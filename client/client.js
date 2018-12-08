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
        `<br>Hi ${name}!!<br><br>` +
        `<button id="startButton" onclick="startSession()">PLAY</button>`;
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
    // Send our ID token to the server along with the request to start a game.
    // TODO: should this be https?
    var url = window.location + `play`;
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
    document.getElementById("main").innerHTML =
    `
    <img src="${question.img}" width=300 height=300><br><br>
    <div id="questionDiv">
        <form id="answerForm">
            Who's this? <input id="nameText" type="text" name="name" onkeydown="onEnterSubmitAnswer(event)" autofocus><br>
            <input type="hidden" name="id" value="${question.id}">
        </form>
        <button onclick="onSubmitAnswer()">SUBMIT</button>
    </div>
    `;
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
    var right = response.right;
    var wrong = response.wrong;
    var total = response.total;
    var sofar = right + wrong;
    var remaining = total - sofar;
    
    document.getElementById("main").innerHTML =
        `<img src="${response.img}" width=300 height=300><br><br>` +
        (response.correct ? "Yes" : "No") + `, it's ${response.name}!!` +
        `<br><br>Score: ${right}/${sofar} (${remaining} remaining)` +
        (remaining > 0
            ? `<br><br><button id="nextButton" onclick="continueSession(${response.id})">NEXT</button>`
            : "<br><br>Thanks for playing!!");
    document.getElementById("nextButton").focus();
}

function onError(statusText)
{
    document.getElementById("main").innerHTML = statusText;
}

function endSession()
{
    document.getElementById("main").innerHTML = "DONE!<br>"+window.location;
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
