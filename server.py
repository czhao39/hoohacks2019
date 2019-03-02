#!/usr/bin/env python3

from flask import *
app = Flask(__name__, static_url_path="")


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
    import sys
    app.run(host="0.0.0.0", port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080, threaded=True)
