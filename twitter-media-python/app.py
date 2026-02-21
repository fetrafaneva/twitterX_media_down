from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import subprocess
import sys
from pathlib import Path
import zipfile
import time
import json
import threading
import os

app = Flask(__name__)
CORS(app)

DOWNLOAD_DIR = Path.home() / "Downloads" / "twitter_media"
PROGRESS = {}

# ================
# STREAM PROGRESS 
# ================
@app.route("/progress/<username>")
def progress(username):
    def event_stream():
        last = None
        while True:
            current = PROGRESS.get(username)
            if current != last and current is not None:
                yield f"data: {json.dumps(current)}\n\n"
                last = current

            if current and current["status"] in ["done", "error"]:
                break

            time.sleep(0.5)

    return Response(event_stream(), mimetype="text/event-stream")


def count_files(username, user_dir):
    while PROGRESS.get(username, {}).get("status") == "downloading":
        if user_dir.exists():
            PROGRESS[username]["count"] = sum(
                1 for f in user_dir.rglob("*") if f.is_file()
            )
        time.sleep(0.5)


# ======================
# DOWNLOAD MEDIA
# ======================
@app.route("/media", methods=["POST"])
def download_media():
    data = request.get_json()
    username = data.get("username")

    if not username:
        return jsonify({"error": "username required"}), 400

    username = username.lstrip("@").strip().lower()
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # DOSSIER UTILISE PAR GALLERY-DL
    user_dir = DOWNLOAD_DIR / "twitter" / username
    zip_path = DOWNLOAD_DIR / f"{username}-media.zip"

    PROGRESS[username] = {
        "status": "starting",
        "message": "Initialisation…",
        "count": 0
    }

    cmd = [
        sys.executable,
        "-m",
        "gallery_dl",
        "--cookies",
        "C:/Users/ASUS/Desktop/twitterX_media_down/cookies.txt",
        "-d",
        str(DOWNLOAD_DIR),
        f"https://x.com/{username}"
    ]

    try:
        PROGRESS[username]["status"] = "downloading"
        PROGRESS[username]["message"] = "Téléchargement des médias…"

        threading.Thread(
            target=count_files,
            args=(username, user_dir),
            daemon=True
        ).start()

        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)

        if not user_dir.exists() or not any(user_dir.rglob("*")):
            PROGRESS[username] = {
                "status": "error",
                "message": "Aucun média trouvé"
            }
            return jsonify({"error": "no media"}), 404

        PROGRESS[username]["status"] = "zipping"
        PROGRESS[username]["message"] = "Création du ZIP…"

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file in user_dir.rglob("*"):
                if file.is_file():
                    zipf.write(file, file.relative_to(user_dir))

        PROGRESS[username]["status"] = "done"
        PROGRESS[username]["message"] = "Téléchargement terminé"

        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f"{username}-media.zip",
            mimetype="application/zip"
        )

    except subprocess.CalledProcessError:
        PROGRESS[username] = {
            "status": "error",
            "message": "Erreur lors du téléchargement"
        }
        return jsonify({"error": "download failed"}), 500


if __name__ == "__main__":
    app.run(debug=True)