"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [fileCount, setFileCount] = useState(0);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading || !username) return;

    const clean = username.replace("@", "").trim().toLowerCase();
    const source = new EventSource(`http://127.0.0.1:5000/progress/${clean}`);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatus(data.message ?? "");

        if (data.count !== undefined) setFileCount(data.count);

        const progressMap: Record<string, number> = {
          starting: 10,
          downloading: 60,
          zipping: 85,
          done: 100,
          error: 0,
        };
        setProgress(progressMap[data.status] ?? progress);

        if (data.status === "error") {
          setError(data.message ?? "Une erreur est survenue");
          source.close();
        }
        if (data.status === "done") source.close();
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

  const handleDownload = async () => {
    // Reset de l'état
    setError("");
    setStatus("");
    setProgress(5);
    setFileCount(0);
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        // Tenter de lire le message d'erreur JSON
        const contentType = res.headers.get("content-type") ?? "";
        const errData = contentType.includes("application/json")
          ? await res.json()
          : { error: await res.text() };
        throw new Error(errData.error ?? `Erreur HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Le fichier ZIP reçu est vide");

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${username.replace("@", "")}-media.zip`;
      a.click();
      window.URL.revokeObjectURL(url); // libérer la mémoire
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur réseau inconnue";
      setError(message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const isUsernameValid = username.replace("@", "").trim().length > 0;

  return (
    <main className="flex h-screen items-center justify-center">
      <div className="flex flex-col gap-4 w-96">
        <input
          className="border px-4 py-2 rounded"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />

        <button
          onClick={handleDownload}
          disabled={loading || !isUsernameValid}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Téléchargement…" : "Télécharger"}
        </button>

        {loading && (
          <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-3 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {status && !error && (
          <p className="text-sm text-gray-600 text-center">
            {status}
            {fileCount > 0 && ` (${fileCount} fichiers)`}
          </p>
        )}

        {/* Affichage explicite des erreurs */}
        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
