async function init(ws) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
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