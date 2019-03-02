from flask import *
app = Flask(__name__, static_url_path="")


@app.route("/")
def landing():
    return render_template("landing.html")

@app.route("/host")
def host_landing():
    return render_template("landing.html")

@app.route("/host/<meeting_id>")
def host(meeting_id=None):
    return render_template("landing.html")

@app.route("/watch")
def watch_landing():
    return render_template("landing.html")

@app.route("/watch/<meeting_id>")
def watch(meeting_id=None):
    return render_template("landing.html")


if __name__ == "__main__":
    import sys
    app.run(host="0.0.0.0", port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080, threaded=True)
