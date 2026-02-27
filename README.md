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
