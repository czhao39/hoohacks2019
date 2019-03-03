async function init(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const videoElement = document.getElementById("self-video");
    videoElement.srcObject = stream;
    videoElement.play();

    var recog = new webkitSpeechRecognition();
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = true;
    recog.onresult = function(e) {
        for (var i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
                var transcript = e.results[i][0].transcript;
                showSubtitle(transcript);
            }
        }
    };
    recog.start();
}

function showSubtitle(text) {
    $("#subtitle-text").text(text);
}

$(document).ready(function() {
    const ws = io("http://" + window.location.host + "/");
    ws.on('connect', function() {
        init(ws);
    });
    $('select').formSelect();
});
