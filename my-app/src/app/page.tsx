"use client";

import { useEffect, useRef, useState } from "react";

type Status =
  | "idle"
  | "starting"
  | "downloading"
  | "zipping"
  | "done"
  | "error";
type MediaType = "all" | "images" | "videos" | "gifs";
type Theme = "dark" | "light";

const PROGRESS_MAP: Record<string, number> = {
  starting: 10,
  downloading: 60,
  zipping: 88,
  done: 100,
  error: 0,
};

const STATUS_COLORS: Record<string, string> = {
  starting: "from-violet-500 to-indigo-500",
  downloading: "from-blue-500 to-cyan-400",
  zipping: "from-amber-400 to-orange-500",
  done: "from-emerald-400 to-green-500",
  error: "from-red-500 to-rose-500",
};

const MEDIA_OPTIONS: { value: MediaType; label: string; icon: string }[] = [
  { value: "all", label: "Tout", icon: "⊞" },
  { value: "images", label: "Photos", icon: "🖼" },
  { value: "videos", label: "Vidéos", icon: "🎬" },
  { value: "gifs", label: "GIFs", icon: "🎞" },
];

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function sendNotification(fileCount: number, username: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("✅ Téléchargement terminé", {
      body: `${fileCount} fichier${
        fileCount > 1 ? "s" : ""
      } de @${username} téléchargés`,
      icon: "/favicon.ico",
    });
  }
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("all");
  const [theme, setTheme] = useState<Theme>("dark");
  const [notifAsked, setNotifAsked] = useState(false);

  const prevCountRef = useRef(0);
  const prevTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const dark = theme === "dark";

  // ── Demander permission notifications au 1er chargement ────────
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !notifAsked
    ) {
      Notification.requestPermission();
      setNotifAsked(true);
    }
  }, []);

  // ── Timer elapsed ──────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  // ── SSE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading || !username) return;

    const clean = username.replace("@", "").trim().toLowerCase();
    const source = new EventSource(`http://127.0.0.1:5000/progress/${clean}`);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setMessage(data.message ?? "");
        setStatus(data.status as Status);
        setProgress(PROGRESS_MAP[data.status] ?? 0);

        if (data.count !== undefined) {
          const now = Date.now() / 1000;
          const prevCount = prevCountRef.current;
          const prevTime = prevTimeRef.current;
          if (prevTime > 0 && now - prevTime > 0) {
            setSpeed(
              Math.round(((data.count - prevCount) / (now - prevTime)) * 10) /
                10
            );
          }
          prevCountRef.current = data.count;
          prevTimeRef.current = now;
          setFileCount(data.count);
        }

        if (data.status === "done") {
          sendNotification(data.count ?? fileCount, clean);
          source.close();
        }
        if (data.status === "error") {
          setError(data.message ?? "Erreur inconnue");
          source.close();
        }
      } catch {
        setError("Réponse SSE invalide");
        source.close();
      }
    };

    source.onerror = () => {
      setError("Connexion au serveur perdue");
      setProgress(0);
      source.close();
    };

    return () => source.close();
  }, [loading, username]);

  // ── Download ───────────────────────────────────────────────────
  const handleDownload = async () => {
    setError("");
    setMessage("");
    setProgress(5);
    setFileCount(0);
    setSpeed(0);
    setElapsed(0);
    setStatus("starting");
    prevCountRef.current = 0;
    prevTimeRef.current = 0;
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mediaType }), // ← mediaType envoyé
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        const err = ct.includes("application/json")
          ? (await res.json()).error
          : await res.text();
        throw new Error(err ?? `Erreur HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("ZIP reçu est vide");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${username.replace("@", "")}-${mediaType}-media.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau inconnue";
      setError(msg);
      setProgress(0);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const isValid = username.replace("@", "").trim().length > 0;
  const gradClass = STATUS_COLORS[status] ?? STATUS_COLORS.downloading;

  return (
    <main
      className="relative min-h-screen flex items-center justify-center p-4 transition-colors duration-300"
      style={{
        backgroundImage: "url('/bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-colors duration-300 ${
          dark ? "bg-black/50" : "bg-white/40"
        }`}
      />

      <div className="relative z-10 w-full max-w-md">
        <div
          className={`backdrop-blur-md border rounded-2xl p-8 shadow-2xl transition-colors duration-300 ${
            dark ? "bg-white/10 border-white/20" : "bg-white/80 border-white/60"
          }`}
        >
          {/* ── Header + toggle thème ──────────────────────────── */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1
                className={`text-2xl font-bold ${
                  dark ? "text-white" : "text-slate-800"
                }`}
              >
                X Media Downloader
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Téléchargez les médias d'un profil X
              </p>
            </div>

            {/* Toggle thème */}
            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              className={`p-2 rounded-xl border transition-all ${
                dark
                  ? "bg-white/10 border-white/20 text-yellow-300 hover:bg-white/20"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
              }`}
              title="Changer le thème"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          {/* ── Sélecteur type de média ────────────────────────── */}
          <div className="mb-4">
            <p
              className={`text-xs font-medium uppercase tracking-wider mb-2 ${
                dark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Type de média
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MEDIA_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMediaType(opt.value)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition-all disabled:opacity-40 ${
                    mediaType === opt.value
                      ? "bg-gradient-to-br from-blue-500 to-cyan-400 border-transparent text-white shadow-lg scale-105"
                      : dark
                      ? "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Input ─────────────────────────────────────────── */}
          <div className="relative mb-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              @
            </span>
            <input
              className={`w-full border rounded-xl pl-9 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50 ${
                dark
                  ? "bg-white/10 border-white/20 text-white placeholder-slate-500"
                  : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"
              }`}
              placeholder="username"
              value={username}
              disabled={loading}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && isValid && !loading && handleDownload()
              }
            />
          </div>

          {/* ── Button ────────────────────────────────────────── */}
          <button
            onClick={handleDownload}
            disabled={loading || !isValid}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg ${
              loading || !isValid
                ? "bg-slate-400 opacity-50 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 hover:scale-[1.02] active:scale-100"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Téléchargement en cours…
              </span>
            ) : (
              "Télécharger"
            )}
          </button>

          {/* ── Progress ──────────────────────────────────────── */}
          {loading && (
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
                    {message || "En cours…"}
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      dark ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {progress}%
                  </span>
                </div>
                <div
                  className={`w-full rounded-full h-3 overflow-hidden ${
                    dark ? "bg-white/10" : "bg-slate-200"
                  }`}
                >
                  <div
                    className={`h-3 rounded-full bg-gradient-to-r ${gradClass} transition-all duration-700 ease-out relative`}
                    style={{ width: `${progress}%` }}
                  >
                    <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    value: fileCount,
                    color: dark ? "text-white" : "text-slate-800",
                    label: "fichiers",
                  },
                  {
                    value: speed > 0 ? speed : "—",
                    color: "text-cyan-500",
                    label: "fichiers/s",
                  },
                  {
                    value: formatDuration(elapsed),
                    color: "text-violet-500",
                    label: "écoulé",
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`border rounded-xl p-3 text-center ${
                      dark
                        ? "bg-white/5 border-white/10"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div
                      className={`text-2xl font-bold tabular-nums ${stat.color}`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────── */}
          {status === "done" && !loading && (
            <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
              <div className="text-emerald-400 font-semibold">
                ✓ Téléchargement terminé
              </div>
              <div className="text-slate-400 text-sm mt-1">
                {fileCount} fichier{fileCount > 1 ? "s" : ""} en{" "}
                {formatDuration(elapsed)}
              </div>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────── */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-red-400 text-lg">⚠</span>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
