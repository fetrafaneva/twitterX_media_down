import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let username: string;

  try {
    const body = await req.json();
    username = body?.username;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username requis" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 320_000); // 320s

    let flaskRes: Response;
    try {
      flaskRes = await fetch("http://127.0.0.1:5000/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!flaskRes.ok) {
      const contentType = flaskRes.headers.get("content-type") ?? "";
      const errBody = contentType.includes("application/json")
        ? await flaskRes.json()
        : { error: await flaskRes.text() };
      return NextResponse.json(
        { error: errBody.error ?? "Erreur Flask" },
        { status: flaskRes.status }
      );
    }

    const buffer = await flaskRes.arrayBuffer();
    if (buffer.byteLength === 0) {
      return NextResponse.json(
        { error: "ZIP vide reçu depuis Flask" },
        { status: 500 }
      );
    }

    const cleanName = username.replace("@", "").trim();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${cleanName}-media.zip"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Timeout : Flask a mis trop de temps à répondre" },
        { status: 504 }
      );
    }
    console.error("[route /media]", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
