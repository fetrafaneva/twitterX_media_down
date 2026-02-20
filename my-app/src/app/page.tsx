"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!loading || !username) return;

    const clean = username.replace("@", "");
    const evtSource = new EventSource(
      `http://127.0.0.1:5000/progress/${clean}`
    );

    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);

      if (["done", "error"].includes(data.status)) {
        evtSource.close();
      }
    };

    return () => evtSource.close();
  }, [loading, username]);

  const handleDownload = async () => {
    setLoading(true);
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

        {status && (
          <div className="text-sm text-gray-600 text-center">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}