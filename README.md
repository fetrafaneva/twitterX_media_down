# 𝕏 Media Downloader

A full-stack web app to download all media (photos, videos, GIFs) from any X (Twitter) profile as a ZIP file, powered by [gallery-dl](https://github.com/mikf/gallery-dl).

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
├── app/
│   ├── page.tsx          # Main UI component
│   └── api/
│       └── route.ts      # Next.js API route (proxy to Flask)
├── public/
│   └── bg.jpg            # Background image
├── app.py                # Flask backend
└── README.md
```

---
