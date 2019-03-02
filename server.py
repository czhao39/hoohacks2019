#!/usr/bin/env python3

import os
import sys
import random

from flask import *
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="")
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)


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
    print(msg)


@socketio.on('connect')
def on_connect():
    # TODO: add person to room
    print("Socket Connected")


@socketio.on('disconnect')
def on_disconnect():
    # TODO: remove person from room
    print("Socket Disconnected")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)
