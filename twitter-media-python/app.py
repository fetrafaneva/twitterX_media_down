from flask import Flask, request, jsonify
import snscrape.modules.twitter as sntwitter

app = Flask(__name__)

@app.route("/media", methods=["POST"])
def get_media():
    try:
        data = request.get_json()
        username = data.get("username")

        if not username:
            return jsonify({"error": "username requis"}), 400

        media_urls = []
        max_tweets = 50  # limite pour éviter crash

        for i, tweet in enumerate(
            sntwitter.TwitterUserScraper(username).get_items()
        ):
            if i >= max_tweets:
                break

            if not tweet.media:
                continue

            for media in tweet.media:
                url = getattr(media, "fullUrl", None)
                if url:
                    media_urls.append(url)

        return jsonify({
            "username": username,
            "count": len(media_urls),
            "media": media_urls
        })

    except Exception as e:
        print("❌ ERREUR:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)
