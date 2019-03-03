#!/usr/bin/env python3

import os
import sys
import random
import io
import time
import subprocess
import threading
import redis

from collections import deque

from google.cloud import speech
from google.cloud.speech import enums
from google.cloud.speech import types
from google.cloud import translate

from flask import *
from flask_socketio import SocketIO, join_room, leave_room

app = Flask(__name__, static_url_path="")
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)

if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
    recog_client = speech.SpeechClient()
    translate_client = translate.Client()
    recog_config = types.RecognitionConfig(
                       encoding=enums.RecognitionConfig.AudioEncoding.FLAC,
                       sample_rate_hertz=48000,
                       language_code='en-US')
    streaming_config = types.StreamingRecognitionConfig(config=recog_config)
    redis = redis.Redis(host='localhost', port=6379, db=0)


@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/host")
def host():
    with open("./static/english-adjectives.txt", "r") as f:
        adjectives = [x.strip() for x in f.readlines()]

    with open("./static/english-nouns.txt", "r") as f:
        nouns = [x.strip() for x in f.readlines()]

    call_id = "{}-{}-{}".format(random.choice(adjectives), random.choice(adjectives), random.choice(nouns))

    return redirect("/call/" + call_id + "?role=host", code=302)

@app.route("/call/<call_id>")
def call(call_id):
    return render_template("call.html", event_id=call_id, role=request.args.get("role", "watch"))

@app.route("/watch")
def watch_landing():
    return render_template("watch_landing.html")


@socketio.on('sound')
def on_message(msg):
    flac = convert_audio(msg)
    sid = str(request.sid)
    if "init" not in session:
        session["init"] = True
        threading.Thread(target=transcribe_streaming, args=(sid, flac)).start()
    else:
        redis.publish(sid, flac)


@socketio.on('translate')
def on_translate(msg):
    output = translate_text(msg['text'], msg['lang'])
    socketio.emit('translate', output)


def convert_audio(content):
    return subprocess.check_output(["ffmpeg", "-f", "webm", "-i", "pipe:0", "-f", "flac", "pipe:1"], input=content, stderr=subprocess.DEVNULL)

@socketio.on('connect')
def on_connect():
    join_room(str(request.sid))


@socketio.on('broadcast')
def on_broadcast(msg):
    socketio.emit('broadcast', msg["text"], room=msg["room"])


@socketio.on('join')
def on_join(msg):
    rid = msg["room"]
    join_room(rid)
    if msg["role"] == "host":
        redis.set("sid:{}".format(rid), str(request.sid))


@socketio.on('relayICECandidate')
def on_ice_candidate(msg):
    peer_id = msg["peer_id"]
    socketio.emit('iceCandidate', msg, room=peer_id)


@socketio.on('relaySessionDescription')
def on_relay_session(msg):
    peer_id = msg["peer_id"]
    socketio.emit('sessionDescription', msg, room=peer_id)


@socketio.on('disconnect')
def on_disconnect():
    leave_room(str(request.sid))


def transcribe_audio(stream):
    content = stream.read()
    audio = types.RecognitionAudio(content=content)
    response = recog_client.recognize(recog_config, audio)
    text = [res.alternatives[0].transcript for res in response.results]
    return text

def audio_generator(sid, flac):
    p = redis.pubsub()
    p.subscribe(sid)
    yield flac
    for message in p.listen():
        info = message["data"]
        if not isinstance(info, int):
            yield info

def transcribe_streaming(sid, flac):
    requests = (types.StreamingRecognizeRequest(audio_content=content)
                for content in audio_generator(sid, flac))
    responses = recog_client.streaming_recognize(streaming_config, requests)
    for response in responses:
        if response.results[0].is_final:
            text = response.results[0].alternatives[0].transcript
            socketio.emit("text", text)

def translate_text(text, target_lang):
    translation = translate_client.translate(text, target_language=target_lang)
    return translation["translatedText"]


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)
