import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/server-auth";
import { getArtistFollowers } from "@/lib/db";

const RESEND_URL = "https://api.resend.com/emails";
const BATCH_SIZE = 50;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * POST /api/newsletter/send
 * Artist-only. Sends a newsletter to every subscriber (follower) of the
 * artist via the Resend API, batching recipients (50 per request).
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (payload.role !== "artist") {
    return NextResponse.json({ error: "Only the artist can send newsletters" }, { status: 403 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Resend is not configured yet (RESEND_API_KEY)." },
      { status: 500 }
    );
  }

  let body: { subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const message = body.message?.trim();
  if (!subject || !message) {
    return NextResponse.json(
      { error: "Subject and message are required" },
      { status: 400 }
    );
  }

  const subscribers = await getArtistFollowers();
  const emails = [...new Set(subscribers.map((s) => s.email).filter(Boolean))];

  if (emails.length === 0) {
    return NextResponse.json(
      { sent: 0, failed: 0, recipients: 0, error: "No subscribers yet" },
      { status: 200 }
    );
  }

  const from = process.env.RESEND_FROM ?? "Kendrick David <onboarding@resend.dev>";
  const html = `<p>${escapeText(message).replace(/\r?\n/g, "<br/>")}</p>`;
  const text = message.replace(/\r?\n/g, "\n");

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(RESEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: batch,
          subject,
          html,
          text,
        }),
      });

      if (res.ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
        const detail = await res.text().catch(() => "");
        console.error("Newsletter batch failed:", res.status, detail);
      }
    } catch (error) {
      failed += batch.length;
      console.error("Newsletter batch error:", error);
    }
  }

  return NextResponse.json({ sent, failed, recipients: emails.length });
}