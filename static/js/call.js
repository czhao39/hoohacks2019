function resizeInterface() {
    $(".transcript-recorder").outerHeight($("#self-video").outerHeight());
}

function init(ws, callback) {
    if (window.role !== "host") {
        callback(null);
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(stream) {
        const videoElement = document.getElementById("self-video");
        videoElement.setAttribute("muted", true);
        videoElement.srcObject = stream;
        videoElement.play();

        window.recog = new webkitSpeechRecognition();
        var tempString = "";
        window.recog.lang = "en-US";
        var $lang = $("#language");
        $lang.change(function() {
            window.recog.stop();
            window.recog.lang = $lang.val();
            window.setTimeout(function() { window.recog.start(); }, 200);
        });
        window.recog.interimResults = true;
        window.recog.maxAlternatives = 1;
        window.recog.continuous = true;
        window.recog.onresult = function(e) {
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
        window.recog.onerror = function(e) {
            if (e.error === "network") {
                M.toast({
                    html: "Network error while connecting to text-to-speech server!",
                    classes: "red lighten-2"
                });
            }
            else {
                console.log("SpeechRecognition error: " + e.error);
            }
        };
        window.recog.start();
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
    ws.emit("translate", {"text": text, "lang": lang});
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

    window.host_paused = false;
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

                if (window.role === "host") {
                    stream.getTracks().forEach(track => conn.addTrack(track, stream));
                }

                conn.onaddtrack = function(e) {
                    if (window.role !== "host") {
                        $("#self-video")[0].srcObject = e.streams[0];
                    }
                };

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
                });
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

        ws.on('videoControl', function(action) {
            if (action == "play") {
                $("#self-video")[0].play();
            }
            else {
                $("#self-video")[0].pause();
            }
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
    var $videoEle = $("#self-video");

    function updateRecordButtonState() {
        if (window.host_paused) {
            $recordBtn.removeClass("red");
            $recordBtn.addClass("blue-grey");
            $recordBtn.removeClass("pulse");
            $videoEle[0].pause();
            if (window.recog) {
                window.recog.stop();
            }
            ws.emit('videoControl', 'pause');
        } else {
            $recordBtn.removeClass("blue-grey");
            $recordBtn.addClass("red");
            $recordBtn.addClass("pulse");
            $videoEle[0].play();
            if (window.recog) {
                window.recog.start();
            }
            ws.emit('videoControl', 'play');
        }
    }

    $recordBtn.click(function() {
        window.host_paused = !window.host_paused;
        updateRecordButtonState();
    });

    updateRecordButtonState();
});
