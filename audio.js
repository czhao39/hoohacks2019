async function init() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
    mediaRecorder.ondataavailable = function(data) {
        ws.send(data.data);
    };
    mediaRecorder.start(500);
}

window.onload = function() {
    init();
};
