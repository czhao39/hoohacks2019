async function init(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const videoElement = document.getElementById("self-video");
    videoElement.srcObject = stream;
    videoElement.play();
    const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 16000,
        mimeType: "audio/webm"
    });
    var chunks = [];
    mediaRecorder.ondataavailable = function(e) {
        chunks.push(e.data);
    };
    mediaRecorder.onstop = function() {
        ws.emit('sound', new Blob(chunks));
        chunks = [];
        mediaRecorder.start();
    };
    mediaRecorder.start();
    setInterval(function() {
        mediaRecorder.stop();
    }, 500);
}

$(document).ready(function() {
    const ws = io("http://" + window.location.host + "/");
    ws.on('connect', function() {
        init(ws);
    });
});
