"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);

  // 🔁 écouter la progression depuis Flask
  useEffect(() => {
    if (!loading || !username) return;

    const clean = username.replace("@", "");
    const source = new EventSource(`http://127.0.0.1:5000/progress/${clean}`);

    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);

      switch (data.status) {
        case "starting":
          setProgress(10);
          break;
        case "downloading":
          setProgress(60);
          break;
        case "zipping":
          setProgress(85);
          break;
        case "done":
          setProgress(100);
          source.close();
          break;
        case "error":
          setProgress(0);
          source.close();
          break;
      }
    };

    return () => source.close();
  }, [loading, username]);

  // ⬇️ lancer le téléchargement
  const handleDownload = async () => {
    setLoading(true);
    setProgress(5);
    setStatus("Initialisation…");

    const res = await fetch("http://127.0.0.1:5000/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}-media.zip`;
    a.click();

    setLoading(false);
  };

  return (
    <main className="flex h-screen items-center justify-center">
      <div className="flex flex-col gap-4 w-96">
        <input
          className="border px-4 py-2 rounded"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <button
          onClick={handleDownload}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Téléchargement…" : "Télécharger"}
        </button>

        {/* BARRE DE PROGRESSION */}
        {loading && (
          <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {status && (
          <p className="text-sm text-gray-600 text-center">
            {status} ({progress}%)
          </p>
        )}
      </div>
    </main>
  );
}
