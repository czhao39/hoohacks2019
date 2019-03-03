async function init(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const videoElement = document.getElementById("self-video");
    videoElement.srcObject = stream;
    videoElement.play();
    const mediaRecorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 16000,
        mimeType: "audio/webm;codecs=opus"
    });
    mediaRecorder.ondataavailable = function(data) {
        ws.emit('sound', data.data);
    };
    mediaRecorder.start(500);
}

$(document).ready(function() {
    const ws = io("http://" + window.location.host + "/");
    ws.on('connect', function() {
        init(ws);
    });
});
