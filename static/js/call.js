function resizeInterface() {
    $(".transcript-recorder").outerHeight($("#self-video").outerHeight());
}

function init(ws, callback) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(stream) {
        if (window.role !== "host") {
            callback(stream);
            return;
        }

        const videoElement = document.getElementById("self-video");
        videoElement.setAttribute("muted", true);
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
                var isFinal = e.results[i].isFinal;
                if (isFinal) {
                    showSubtitle(transcript, ws, isFinal);
                    updateTranscriptRecorder(transcript);
                    tempString = "";
                }
                else {
                    if (tempString.length < transcript.length) {
                        tempString = transcript;
                        showSubtitle(tempString, ws, isFinal);
                    }
                }
            }
        };
        recog.onerror = function(e) {
            console.log("SpeechRecognition error: " + e.error);
        };
        recog.start();
        callback(stream);
    }).catch(function(e) {
        if (window.location.protocol === "http:" && window.location.hostname.indexOf("localhost") !== 0) {
            location.href = "https:" + window.location.href.substring(window.location.protocol.length);
        }
        else {
            console.log("getUserMedia error: " + e);
        }
    });
}

function showSubtitle(text, ws, isFinal) {
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
    if (window.role == "host" && !window.host_paused) {
        ws.emit("sub", {"text": text, "room": window.room, "isFinal": isFinal});
    }
}

function updateTranscriptRecorder(text) {
    var $container = $(".transcript-recorder");
    var $block = $("<blockquote>" + $("<div />").text(text).html() + "</blockquote>").appendTo($container);
    $block.css("backgroundColor", "yellow");
    $block.animate({backgroundColor: "white"}, 500);
    $container.scrollTop($container[0].scrollHeight);
}

$(document).ready(function() {
    var peers = {};

    window.host_paused = true;
    const ws = io(window.location.protocol + "//" + window.location.host + "/");
    ws.on('connect', function() {
        var role = $("#event-role kbd").text();
        var room = $("#event-id kbd").text();
        window.role = role;
        window.room = room;

        if (window.role !== "host") {
            $('.record-btn').hide();
        }

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
                    if (window.role !== "host") {
                        var vid = $("#self-video");
                        vid.prop("autoplay", true).prop("controls", false);
                        vid[0].srcObject = e.stream;
                    }
                };

                conn.addStream(stream);

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
                var remote_description = JSON.parse(config.session_description);
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

        init(ws, finishFunction);

        ws.on('sub', function(obj) {
            showSubtitle(obj.text, ws);
            if (obj.isFinal) {
                updateTranscriptRecorder(obj.text);
            }
        });

        ws.on('translate', function(text) {
            $("#subtitle-text").text(text);
        });
    });
    $('select').formSelect();
    $("#self-video").resize(function() {
        resizeInterface();
    });
    $(window).resize(function() {
        resizeInterface();
    });
    resizeInterface();

    var $recordBtn = $(".record-btn");
    $recordBtn.click(function() {
        window.host_paused = !window.host_paused;
        if (window.host_paused) {
            $recordBtn.removeClass("red");
            $recordBtn.addClass("blue-grey");
            $recordBtn.removeClass("pulse");
        } else {
            $recordBtn.removeClass("blue-grey");
            $recordBtn.addClass("red");
            $recordBtn.addClass("pulse");
        }
    });
});
