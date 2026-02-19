from flask import Flask, request, jsonify
import subprocess
import sys
import os

app = Flask(__name__)

DOWNLOAD_DIR = "downloads/twitter"

@app.route("/media", methods=["POST"])
def download_media():
    data = request.get_json()
    username = data.get("username")

    if not username:
        return jsonify({"error": "username required"}), 400

    cmd = [
        sys.executable,
        "-m",
        "gallery_dl",
        "--cookies",
        "C:/Users/ASUS/Desktop/twitterX_media_down/cookies.txt",
        f"https://x.com/{username}"
    ]

    try:
        subprocess.run(cmd, check=True)

        user_dir = os.path.join(DOWNLOAD_DIR, username)
        files = os.listdir(user_dir) if os.path.exists(user_dir) else []

        return jsonify({
            "username": username,
            "count": len(files),
            "files": files
        })

    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
