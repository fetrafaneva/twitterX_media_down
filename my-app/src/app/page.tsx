"use client";

import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);

    const res = await fetch("/api/download", {
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
      <div className="flex gap-3">
        <input
          className="border px-4 py-2 rounded"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button
          onClick={handleDownload}
          className="bg-black text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Téléchargement..." : "Télécharger"}
        </button>
      </div>
    </main>
  );
}
