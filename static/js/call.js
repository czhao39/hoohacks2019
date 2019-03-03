async function init(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const videoElement = document.getElementById("self-video");
    videoElement.srcObject = stream;
    videoElement.play();

    var recog = new webkitSpeechRecognition();
    var tempString = "";
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.continuous = true;
    recog.onresult = function(e) {
        for (var i = e.resultIndex; i < e.results.length; ++i) {
            var transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
                showSubtitle(transcript, ws);
                tempString = "";
            }
            else {
                if (tempString.length < transcript.length) {
                    tempString = transcript;
                    showSubtitle(tempString, ws);
                }
            }
        }
    };
    recog.start();
}

function showSubtitle(text, ws) {
    if (text.length > 60) {
        $("#subtitle-text").css("font-size", "2em");
    }
    else {
        $("#subtitle-text").css("font-size", "3em");
    }
    var lang = $("#language").val();
    if (lang == "en") {
        $("#subtitle-text").text(text);
    }
    else {
        ws.emit("translate", {"text": text, "lang": lang});
    }
}

$(document).ready(function() {
    const ws = io("http://" + window.location.host + "/");
    ws.on('connect', function() {
        init(ws);

        ws.on('translate', function(text) {
            $("#subtitle-text").text(text);
        });
    });
    $('select').formSelect();
});
