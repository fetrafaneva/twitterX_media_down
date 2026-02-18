from flask import Flask, request, jsonify
import snscrape.modules.twitter as sntwitter

app = Flask(__name__)

@app.route("/media", methods=["POST"])
def get_media():
    data = request.get_json()
    username = data.get("username")

    if not username:
        return jsonify({"error": "username requis"}), 400

    media_urls = []

    for tweet in sntwitter.TwitterUserScraper(username).get_items():
        if tweet.media:
            for media in tweet.media:
                if hasattr(media, "fullUrl"):
                    media_urls.append(media.fullUrl)

    return jsonify({
        "username": username,
        "count": len(media_urls),
        "media": media_urls
    })

if __name__ == "__main__":
    app.run(port=5000)
