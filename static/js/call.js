function init(ws, callback) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(stream) {
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
        callback(stream);
    });
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
    if (window.role == "host") {
        ws.emit("broadcast", {"text": text, "room": window.room});
    }
}

$(document).ready(function() {
    var peers = {};

    const ws = io("http://" + window.location.host + "/");
    ws.on('connect', function() {
        var role = $("#event-role").text();
        var room = $("#event-id").text();
        window.role = role;
        window.room = room;

        const finishFunction = function(stream) {
            ws.on('addPeer', function(msg) {
                var peer_id = msg.peer_id;
                var conn = new RTCPeerConnection({
                    "iceServers": [{url:"stun:stun.l.google.com:19302"}],
                    "optional": [{"DtlsSrtpKeyAgreement": true}]
                });

                if (peer_id in peers) {
                    return;
                }
                peers[peer_id] = conn;

                conn.onicecandidate = function(e) {
                    if (e.candidate) {
                        ws.emit('relayICECandidate', {
                            'peer_id': peer_id,
                            'ice_candidate': {
                                'sdpMLineIndex': e.candidate.sdpMLineIndex,
                                'candidate': e.candidate.candidate
                            }
                        });
                    }
                };

                conn.onaddstream = function(e) {
                    var vid = $("#self-video");
                    vid.attr("autoplay", "autoplay").attr("controls", "");
                    vid[0].srcObject = e.stream;
                };

                if (role == "host") {
                    conn.addStream(stream);
                }

                if (msg.should_create_offer) {
                    conn.createOffer(function (local_description) {
                        conn.setLocalDescription(local_description, function() {
                            ws.emit('relaySessionDescription', {
                                'peer_id': peer_id,
                                'session_description': JSON.stringify(local_description)
                            });
                        },
                        function(e) {
                            console.log("setLocalDescription error: ", e.message);
                        });
                    },
                    function (error) {
                        console.log("Error sending offer: ", error);
                    });
                }
            });

            ws.on('iceCandidate', function(config) {
                var peer = peers[config.peer_id];
                var ice_candidate = config.ice_candidate;
                peer.addIceCandidate(new RTCIceCandidate(ice_candidate));
            });

            ws.on('sessionDescription', function(config) {
                var peer_id = config.peer_id;
                var peer = peers[peer_id];
                var remote_description = config.session_description;
                var desc = new RTCSessionDescription(remote_description);
                peer.setRemoteDescription(desc, function() {
                        if (remote_description.type == "offer") {
                            peer.createAnswer(
                                function(local_description) {
                                    peer.setLocalDescription(local_description,
                                        function() {
                                            ws.emit('relaySessionDescription', {'peer_id': peer_id, 'session_description': JSON.stringify(local_description)});
                                        },
                                        function() { alert("Answer setLocalDescription failed!"); }
                                    );
                                },
                                function(error) {
                                    console.log("Error creating answer: ", error);
                                    console.log(peer);
                                });
                        }
                    },
                    function(error) {
                        console.log("setRemoteDescription error: ", error.message);
                    }
                );
            });

            ws.emit("join", {"room": room, "role": role});
        };

        if (role == "host") {
            init(ws, finishFunction);
        }
        else {
            ws.on('broadcast', function(text) {
                showSubtitle(text, ws);
            });
            finishFunction(null);
        }

        ws.on('translate', function(text) {
            $("#subtitle-text").text(text);
        });
    });
    $('select').formSelect();
});
