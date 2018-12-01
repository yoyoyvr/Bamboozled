function startSession()
{
    var url = window.location + "random";
    httpGet(url, onNewQuestion, onError);
}

function onNewQuestion(responseText)
{
    var question = JSON.parse(responseText);
    document.getElementById("main").innerHTML =
    `
    <img src="${question.img}">
    <div id="questionDiv">
        <form id="answerForm">
            Who's this? <input type="text" name="name" onkeydown="onEnterSubmitAnswer(event)"><br>
            <input type="hidden" name="id" value="${question.id}">
        </form>
        <button onclick="onSubmitAnswer()">SUBMIT</button>
    </div>
    `;
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
    
    var url = `${window.location}answer?id=${id}&name=${name}`;
    httpGet(url, onAnswerResponse, onError);
}

function onAnswerResponse(responseText)
{
    var response = JSON.parse(responseText);
    document.getElementById("main").innerHTML =
        (response.correct ? "Yes" : "No") + `, that's ${response.name}!!` +
         `<br><br><button onclick="startSession()">AGAIN</button>`;
}

function onError(statusText)
{
    document.getElementById("main").innerHTML = statusText;
}

function continueSession()
{
    document.getElementById("main").innerHTML = "<button onclick=\"endSession()\">END</button>";
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
