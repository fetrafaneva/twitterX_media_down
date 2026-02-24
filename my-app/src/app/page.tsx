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
    new Notification("Téléchargement terminé", {
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
  const [theme, setTheme] = useState<Theme>("light");
  const [notifAsked, setNotifAsked] = useState(false);

  const prevCountRef = useRef(0);
  const prevTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const dark = theme === "dark";

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

  const handleCancel = async () => {
    abortControllerRef.current?.abort();
    const clean = username.replace("@", "").trim().toLowerCase();
    try {
      await fetch(`http://127.0.0.1:5000/cancel/${clean}`, { method: "POST" });
    } catch {
      /* Flask injoignable, on ignore */
    }
    setLoading(false);
    setStatus("idle");
    setProgress(0);
    setMessage("");
    setError("Téléchargement annulé");
  };

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

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("http://127.0.0.1:5000/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, mediaType }),
        signal: abortControllerRef.current.signal,
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
      if (err instanceof Error && err.name === "AbortError") return; // annulé volontairement
      const msg = err instanceof Error ? err.message : "Erreur réseau inconnue";
      setError(msg);
      setProgress(0);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const isValid = username.replace("@", "").trim().length > 0;

  return (
    <main
      className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${
        dark ? "bg-zinc-950" : "bg-gray-50"
      }`}
    >
      <div className="w-full max-w-sm">
        {/* ── Card ────────────────────────────────────────────────── */}
        <div
          className={`rounded-3xl p-7 transition-all duration-500 ${
            dark
              ? "bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/60"
              : "bg-white border border-gray-200 shadow-lg shadow-gray-100"
          }`}
        >
          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base select-none ${
                  dark ? "bg-white text-black" : "bg-black text-white"
                }`}
              >
                𝕏
              </div>
              <div>
                <h1
                  className={`text-sm font-semibold ${
                    dark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Media Downloader
                </h1>
                <p
                  className={`text-xs ${
                    dark ? "text-zinc-500" : "text-gray-400"
                  }`}
                >
                  Profil X · gallery-dl
                </p>
              </div>
            </div>

            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                dark
                  ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-500"
              }`}
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          {/* ── Divider ───────────────────────────────────────────── */}
          <div
            className={`h-px mb-6 ${dark ? "bg-zinc-800" : "bg-gray-100"}`}
          />

          {/* ── Sélecteur média ───────────────────────────────────── */}
          <p
            className={`text-xs font-medium mb-2 ${
              dark ? "text-zinc-500" : "text-gray-400"
            }`}
          >
            Type de média
          </p>
          <div className="grid grid-cols-4 gap-1.5 mb-5">
            {MEDIA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMediaType(opt.value)}
                disabled={loading}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-40 ${
                  mediaType === opt.value
                    ? dark
                      ? "bg-white text-black shadow-sm"
                      : "bg-black text-white shadow-sm"
                    : dark
                    ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                }`}
              >
                <span className="text-base leading-none">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* ── Input ─────────────────────────────────────────────── */}
          <div className="relative mb-3">
            <span
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm ${
                dark ? "text-zinc-600" : "text-gray-400"
              }`}
            >
              @
            </span>
            <input
              className={`w-full rounded-xl pl-8 pr-4 py-2.5 text-sm transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                dark
                  ? "bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 focus:border-zinc-500"
                  : "bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:bg-white"
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

          {/* ── Boutons ───────────────────────────────────────────── */}
          <div className={`flex gap-2 ${loading ? "" : ""}`}>
            {/* Télécharger */}
            <button
              onClick={handleDownload}
              disabled={loading || !isValid}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                loading || !isValid
                  ? dark
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : dark
                  ? "bg-white text-black hover:bg-gray-100 active:scale-[0.98]"
                  : "bg-black text-white hover:bg-gray-800 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-3.5 h-3.5"
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
                  En cours…
                </span>
              ) : (
                "Télécharger"
              )}
            </button>

            {/* Annuler — visible uniquement pendant le téléchargement */}
            {loading && (
              <button
                onClick={handleCancel}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                  dark
                    ? "bg-zinc-800 text-red-400 hover:bg-red-950 hover:text-red-300 border border-zinc-700"
                    : "bg-gray-100 text-red-500 hover:bg-red-50 hover:text-red-600 border border-gray-200"
                }`}
              >
                ✕ Arrêter
              </button>
            )}
          </div>

          {/* ── Progress ──────────────────────────────────────────── */}
          {loading && (
            <div className="mt-6 space-y-4">
              {/* Barre fine */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className={`text-xs ${
                      dark ? "text-zinc-600" : "text-gray-400"
                    }`}
                  >
                    {message || "En cours…"}
                  </span>
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      dark ? "text-zinc-300" : "text-gray-600"
                    }`}
                  >
                    {progress}%
                  </span>
                </div>
                <div
                  className={`w-full rounded-full h-1 overflow-hidden ${
                    dark ? "bg-zinc-800" : "bg-gray-100"
                  }`}
                >
                  <div
                    className={`h-1 rounded-full transition-all duration-700 ease-out ${
                      dark ? "bg-white" : "bg-black"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stats 3 colonnes */}
              <div className={`h-px ${dark ? "bg-zinc-800" : "bg-gray-100"}`} />
              <div className="grid grid-cols-3">
                {[
                  { value: fileCount, label: "fichiers" },
                  { value: speed > 0 ? speed : "—", label: "fich./sec" },
                  { value: formatDuration(elapsed), label: "écoulé" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center py-1 ${
                      i > 0
                        ? dark
                          ? "border-l border-zinc-800"
                          : "border-l border-gray-100"
                        : ""
                    }`}
                  >
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        dark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {stat.value}
                    </span>
                    <span
                      className={`text-xs ${
                        dark ? "text-zinc-600" : "text-gray-400"
                      }`}
                    >
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────────── */}
          {status === "done" && !loading && (
            <div
              className={`mt-5 rounded-2xl px-4 py-3 flex items-center gap-3 ${
                dark ? "bg-zinc-800" : "bg-gray-50 border border-gray-200"
              }`}
            >
              <span
                className={`text-sm ${dark ? "text-white" : "text-gray-900"}`}
              >
                ✓
              </span>
              <div>
                <p
                  className={`text-sm font-medium ${
                    dark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Terminé
                </p>
                <p
                  className={`text-xs ${
                    dark ? "text-zinc-500" : "text-gray-400"
                  }`}
                >
                  {fileCount} fichier{fileCount > 1 ? "s" : ""} ·{" "}
                  {formatDuration(elapsed)}
                </p>
              </div>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────── */}
          {error && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 flex items-start gap-2.5 ${
                dark
                  ? "bg-red-950/50 border border-red-900/40"
                  : "bg-red-50 border border-red-100"
              }`}
            >
              <span
                className={`text-xs mt-0.5 ${
                  dark ? "text-red-500" : "text-red-400"
                }`}
              >
                ⚠
              </span>
              <p
                className={`text-xs leading-relaxed ${
                  dark ? "text-red-400" : "text-red-500"
                }`}
              >
                {error}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <p
          className={`text-center text-xs mt-4 ${
            dark ? "text-zinc-700" : "text-gray-300"
          }`}
        >
          Propulsé par gallery-dl
        </p>
      </div>
    </main>
  );
}
