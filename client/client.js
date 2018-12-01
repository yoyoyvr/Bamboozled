function onLoad()
{
    document.getElementById("main").innerHTML =
         `<button id="startButton" onclick="startSession()">PLAY</button>`;
    document.getElementById("startButton").focus();
}

function startSession()
{
    var url = window.location + "play";
    httpGet(url, onNewQuestion, onError);
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
    <img src="${question.img}" width=300 height=300>
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
        `<img src="${response.img}" width=300 height=300><br>` +
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

function nasaDemo()
{
    httpGet('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', (data) => {
        var explanation = JSON.parse(data).explanation;
        console.log(explanation);
        document.getElementById("main").innerHTML = explanation;
    });
}

// TODO: put this in a module and make it a class that somewhat emulates the nodejs http.request mechanism
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
