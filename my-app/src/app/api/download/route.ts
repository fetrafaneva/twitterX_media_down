import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: "username required" }, { status: 400 });
    }

    // appel vers Flask
    const flaskRes = await fetch("http://127.0.0.1:5000/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (!flaskRes.ok) {
      const err = await flaskRes.text();
      return new NextResponse(err, { status: 500 });
    }

    // Flask doit renvoyer un ZIP
    const buffer = await flaskRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${username}-media.zip"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
