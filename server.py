#!/usr/bin/env python3

import os
import sys
import random
import io
import subprocess

from google.cloud import speech
from google.cloud.speech import enums
from google.cloud.speech import types
from google.cloud import translate

from flask import *
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="")
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)

recog_client = speech.SpeechClient()
translate_client = translate.Client()
recog_config = types.RecognitionConfig(
                   encoding=enums.RecognitionConfig.AudioEncoding.FLAC,
                   sample_rate_hertz=48000,
                   language_code='en-US')
streaming_config = types.StreamingRecognitionConfig(config=recog_config)


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

    return redirect("/call/" + call_id, code=302)

@app.route("/call/<call_id>")
def call(call_id):
    return render_template("call.html", event_id=call_id)

@app.route("/watch")
def watch_landing():
    return render_template("watch_landing.html")


@socketio.on('sound')
def on_message(msg):
    # TODO: implement sound -> text, msg is webm audio in raw format
    flac = convert_audio(msg)


def convert_audio(content):
    return subprocess.check_output(["ffmpeg", "-f", "webm", "-i", "pipe:0", "-f", "flac", "pipe:1"], input=content, stderr=subprocess.DEVNULL)


@socketio.on('connect')
def on_connect():
    # TODO: add person to room
    print("Socket Connected")


@socketio.on('disconnect')
def on_disconnect():
    # TODO: remove person from room
    print("Socket Disconnected")

def transcribe_audio(stream):
    content = stream.read()
    audio = types.RecognitionAudio(content=content)
    response = recog_client.recognize(recog_config, audio)
    text = [res.alternatives[0].transcript for res in response.results]
    return text

def transcribe_streaming(audio_generator):
    requests = (types.StreamingRecognizeRequest(audio_content=content)
                for content in audio_generator)
    responses = recog_client.streaming_recognize(streaming_config, requests)
    return [res.alternatives[0].transcript for res in responses.results if res.is_final]

def translate_text(text, target_lang):
    translation = translate_client.translate(text, target_language=target_lang)
    return translation["translatedText"]


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)
