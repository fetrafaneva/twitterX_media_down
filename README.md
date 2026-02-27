# 𝕏 Media Downloader

A full-stack web app to download all media (photos, videos, GIFs) from any X (Twitter) profile as a ZIP file, powered by [gallery-dl](https://github.com/mikf/gallery-dl).

---

## ⚠️ Disclaimer

This project is intended for **personal use only**.

It is your responsibility to ensure that your use of this tool complies with [X's Terms of Service](https://twitter.com/en/tos) and the applicable laws in your country. Do not use this tool to download, redistribute, or commercially exploit content that belongs to others without their explicit permission. I takes no responsibility for any misuse of this software.

---

## Features

- **Filter by media type** — download everything, photos only, videos only, or GIFs only
- **Real-time progress** — live progress bar, file count, download speed, and elapsed time via Server-Sent Events (SSE)
- **Cancel anytime** — stop the download mid-way with a single click
- **ZIP download** — all media packed and delivered as a `.zip` file
- **Desktop notifications** — get notified when the download finishes
- **Dark / Light theme** — toggle between themes
- **EN / FR language** — switch between English and French

---
## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14 · TypeScript · Tailwind  |
| Backend  | Python · Flask · gallery-dl         |
| Protocol | REST + Server-Sent Events (SSE)     |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **gallery-dl** — `pip install gallery-dl`
- A valid **X/Twitter cookies file** (for authenticated downloads)

# Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/x-media-downloader.git
cd x-media-downloader
```

### 2. Configure the backend

Open `app.py` and update the cookies path to match your system:

```python
COOKIES_PATH = "C:/Users/YourName/path/to/cookies.txt"
```

> **How to get your cookies file:**
> Use a browser extension like [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) while logged into X, then export as `cookies.txt`.

### 3. Start the Flask backend

```bash
pip install flask flask-cors gallery-dl
python app.py
```

The API will run on `http://127.0.0.1:5000`.

### 4. Start the Next.js frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
x-media-downloader/
├── my-app/src/app
│   ├── page.tsx          # Main UI component
│   └── api/
│       └── route.ts      # Next.js API route (proxy to Flask)
├── twitter-media-python/
│   └── venv            # Background image
│   └── app.py            # Flask backend
└── README.md
```

---

## API Reference

### `POST /media`
Starts the media download for a given username.

**Body:**
```json
{
  "username": "elonmusk",
  "mediaType": "all"
}
```

`mediaType` accepts: `"all"` · `"images"` · `"videos"` · `"gifs"`

**Response:** `application/zip` file stream

---

### `GET /progress/:username`
SSE stream that emits real-time download progress.

**Event payload:**
```json
{
  "status": "downloading",
  "message": "Downloading media…",
  "count": 42,
  "speed": 3.2,
  "elapsed": 18
}
```

`status` values: `starting` · `downloading` · `zipping` · `done` · `error`

---

### `POST /cancel/:username`
Kills the running gallery-dl process for the given user.

---

## Configuration

| Variable           | Location  | Description                              | Default                     |
|--------------------|-----------|------------------------------------------|-----------------------------|
| `COOKIES_PATH`     | `app.py`  | Path to your X/Twitter cookies file      | *(required)*                |
| `DOWNLOAD_DIR`     | `app.py`  | Directory where media is saved           | `~/Downloads/twitter_media` |
| `DOWNLOAD_TIMEOUT` | `app.py`  | Max seconds before aborting gallery-dl   | `300`                       |

---

## Notes on Authentication

X requires authentication to access media from most profiles. You must provide a valid `cookies.txt` file exported from a logged-in X session. The cookies are passed directly to gallery-dl and are never stored or transmitted elsewhere.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot reach x.com` | DNS/network issue or X is blocked in your region | Use a VPN or configure a proxy with `--proxy` |
| `Invalid or expired cookies` | Cookies have expired | Re-export your cookies from the browser |
| `User not found on X` | Username doesn't exist or profile is private | Check the username or use an account that follows the profile |
| `Rate limit reached` | Too many requests to X | Wait a few minutes before trying again |

---

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

If this project helps you, consider starring the repository!
