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
import logging
import time
from threading import Lock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

DOWNLOAD_DIR = Path.home() / "Downloads" / "twitter_media"
PROGRESS: dict = {}
PROGRESS_LOCK = threading.Lock()
COOKIES_PATH = "C:/Users/ASUS/Desktop/twitterX_media_down/cookies.txt"
DOWNLOAD_TIMEOUT = 300  # secondes

def count_files(username: str, user_dir: Path):
    start     = time.time()
    prev_count = 0
    prev_time  = start

    while True:
        with PROGRESS_LOCK:
            status = PROGRESS.get(username, {}).get("status")
        if status != "downloading":
            break

        now = time.time()
        if user_dir.exists():
            count = sum(1 for f in user_dir.rglob("*") if f.is_file())
            dt    = now - prev_time

            speed = round((count - prev_count) / dt, 1) if dt > 0 else 0

            with PROGRESS_LOCK:
                if username in PROGRESS:
                    PROGRESS[username]["count"]   = count
                    PROGRESS[username]["speed"]   = speed        # ← nouveau
                    PROGRESS[username]["elapsed"] = int(now - start)  # ← nouveau

            prev_count = count
            prev_time  = now

        time.sleep(0.5)

def set_progress(username: str, status: str, message: str, count: int | None = None):
    with PROGRESS_LOCK:
        prev = PROGRESS.get(username, {})  # ← récupère l'état précédent
        PROGRESS[username] = {
            "status":  status,
            "message": message,
            "count":   count if count is not None else prev.get("count", 0),
            "speed":   prev.get("speed", 0),    # ← préservé depuis count_files
            "elapsed": prev.get("elapsed", 0),  # ← préservé depuis count_files
        }

def cleanup_progress(username: str, delay: int = 30):
    """Supprime l'entrée PROGRESS après un délai pour éviter les fuites mémoire."""
    def _clean():
        time.sleep(delay)
        with PROGRESS_LOCK:
            PROGRESS.pop(username, None)
    threading.Thread(target=_clean, daemon=True).start()


@app.route("/progress/<username>")
def progress(username: str):
    def event_stream():
        timeout = 400  # secondes max d'écoute
        elapsed = 0

        # Attendre que PROGRESS soit initialisé (max 5s)
        for _ in range(10):
            with PROGRESS_LOCK:
                if username in PROGRESS:
                    break
            time.sleep(0.5)
        else:
            yield f"data: {json.dumps({'status': 'error', 'message': 'Session introuvable'})}\n\n"
            return

        last = None
        while elapsed < timeout:
            with PROGRESS_LOCK:
                current = PROGRESS.get(username)

            if current != last and current is not None:
                yield f"data: {json.dumps(current)}\n\n"
                last = dict(current)

            if current and current["status"] in ["done", "error"]:
                break

            time.sleep(0.5)
            elapsed += 0.5
        else:
            yield f"data: {json.dumps({'status': 'error', 'message': 'Timeout SSE dépassé'})}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")


def count_files(username: str, user_dir: Path):
    while True:
        with PROGRESS_LOCK:
            status = PROGRESS.get(username, {}).get("status")
        if status != "downloading":
            break
        if user_dir.exists():
            count = sum(1 for f in user_dir.rglob("*") if f.is_file())
            with PROGRESS_LOCK:
                if username in PROGRESS:
                    PROGRESS[username]["count"] = count
        time.sleep(0.5)


@app.route("/media", methods=["POST"])
def download_media():
    data = request.get_json(silent=True)  # silent=True évite une exception si le JSON est malformé
    if not data:
        return jsonify({"error": "Corps JSON invalide"}), 400

    username = data.get("username", "").lstrip("@").strip().lower()
    if not username:
        return jsonify({"error": "username requis"}), 400

    # Validation basique du nom d'utilisateur
    if not username.replace("_", "").isalnum() or len(username) > 50:
        return jsonify({"error": "username invalide"}), 400

    if not Path(COOKIES_PATH).exists():
        return jsonify({"error": "Fichier cookies introuvable"}), 500

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    user_dir = DOWNLOAD_DIR / "twitter" / username
    zip_path = DOWNLOAD_DIR / f"{username}-media.zip"

    # Supprimer un ancien ZIP pour éviter de servir un fichier périmé
    if zip_path.exists():
        try:
            zip_path.unlink()
        except OSError as e:
            logger.warning(f"Impossible de supprimer l'ancien ZIP : {e}")

    set_progress(username, "starting", "Initialisation…")

    cmd = [
        sys.executable, "-m", "gallery_dl",
        "--cookies", COOKIES_PATH,
        "-d", str(DOWNLOAD_DIR),
        f"https://x.com/{username}"
    ]

    try:
        set_progress(username, "downloading", "Téléchargement des médias…")

        threading.Thread(target=count_files, args=(username, user_dir), daemon=True).start()

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=DOWNLOAD_TIMEOUT
        )

        if result.returncode != 0:
            logger.error(f"gallery-dl stderr : {result.stderr}")
            set_progress(username, "error", "Erreur gallery-dl")
            cleanup_progress(username)
            return jsonify({"error": "Échec du téléchargement", "detail": result.stderr[:300]}), 500

        if not user_dir.exists() or not any(user_dir.rglob("*")):
            set_progress(username, "error", "Aucun média trouvé")
            cleanup_progress(username)
            return jsonify({"error": "Aucun média trouvé pour cet utilisateur"}), 404

        set_progress(username, "zipping", "Création du ZIP…")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file in user_dir.rglob("*"):
                if file.is_file():
                    zipf.write(file, file.relative_to(user_dir))

        set_progress(username, "done", "Téléchargement terminé")
        cleanup_progress(username)

        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f"{username}-media.zip",
            mimetype="application/zip"
        )

    except subprocess.TimeoutExpired:
        logger.error(f"Timeout pour {username}")
        set_progress(username, "error", f"Timeout après {DOWNLOAD_TIMEOUT}s")
        cleanup_progress(username)
        return jsonify({"error": "Timeout dépassé"}), 504

    except zipfile.BadZipFile as e:
        logger.error(f"Erreur ZIP : {e}")
        set_progress(username, "error", "Erreur lors de la création du ZIP")
        cleanup_progress(username)
        return jsonify({"error": "Erreur ZIP"}), 500

    except Exception as e:
        logger.exception(f"Erreur inattendue pour {username}")
        set_progress(username, "error", "Erreur interne du serveur")
        cleanup_progress(username)
        return jsonify({"error": "Erreur interne"}), 500

if __name__ == "__main__":
    app.run(debug=True)