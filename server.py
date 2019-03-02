#!/usr/bin/env python3

import os
import sys

from flask import *
from flask_socketio import SocketIO

app = Flask(__name__, static_url_path="")
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)


@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/host")
def host_landing():
    return render_template("host_landing.html")

@app.route("/watch")
def watch_landing():
    if "event_id" in request.args:
        return render_template("watch.html", event_id=request.args["event_id"])
    else:
        return render_template("watch_landing.html")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=8080, debug=True)
