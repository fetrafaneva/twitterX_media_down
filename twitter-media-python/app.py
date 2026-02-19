from flask import Flask, request, jsonify, send_file
import subprocess
import sys
import os
from pathlib import Path
import zipfile

app = Flask(__name__)

# Dossier global Téléchargements + sous-dossier twitter_media
DOWNLOAD_DIR = Path.home() / "Downloads" / "twitter_media"

@app.route("/media", methods=["POST"])
def download_media():
    data = request.get_json()
    username = data.get("username")

    if not username:
        return jsonify({"error": "username required"}), 400

    # nettoyer @ si présent
    username = username.lstrip("@").strip()

    # créer le dossier global si nécessaire
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    # commande gallery-dl
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
        # téléchargement des médias
        subprocess.run(cmd, check=True)

        # dossier utilisateur
        user_dir = DOWNLOAD_DIR / username

        # vérifier qu'il y a des fichiers
        if not user_dir.exists() or not any(os.scandir(user_dir)):
            return jsonify({"error": "Aucun média trouvé pour cet utilisateur"}), 404

        # créer un ZIP
        zip_path = DOWNLOAD_DIR / f"{username}-media.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(user_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    arcname = os.path.relpath(full_path, user_dir)
                    zipf.write(full_path, arcname)

        # envoyer le ZIP au frontend
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f"{username}-media.zip",
            mimetype="application/zip"
        )

    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
