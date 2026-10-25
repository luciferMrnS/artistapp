import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, createNewsletterUnsubscribeToken } from "@/lib/server-auth";
import { getNewsletterRecipients } from "@/lib/db";
import { getAppUrl } from "@/lib/supabase-auth-client";

const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 600;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(message: string, unsubscribeUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#111">
<p>${escapeText(message).replace(/\r?\n/g, "<br/>")}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
<p style="font-size:12px;color:#666">Please don't reply to this email. You received it because you registered on the site. <a href="${unsubscribeUrl}" style="color:#666">Unsubscribe</a>.</p>
</div>`;
}

function buildText(message: string, unsubscribeUrl: string): string {
  return `${message.replace(/\r?\n/g, "\n")}\n\n---\nPlease don't reply to this email.\nUnsubscribe: ${unsubscribeUrl}`;
}

function noReplyAddress(from: string): string | undefined {
  const match = from.match(/<([^>]+)>/);
  const address = (match ? match[1] : from).trim();
  const domain = address.split("@")[1]?.trim().toLowerCase();

  if (!domain || domain === "resend.dev") return undefined;
  return `no-reply@${domain}`;
}

/**
 * POST /api/newsletter/send
 * Artist-only. Sends a newsletter to every verified registered fan who has
 * not unsubscribed, using the Resend batch API.
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

  const { recipients, error: recipientsError } = await getNewsletterRecipients();
  if (recipientsError) {
    const hint = /newsletter_opt_out_at/i.test(recipientsError)
      ? "Run database/migration_newsletter.sql in Supabase first."
      : undefined;
    return NextResponse.json(
      {
        error: "Could not load newsletter recipients.",
        ...(hint ? { hint } : {}),
      },
      { status: 500 }
    );
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { sent: 0, failed: 0, recipients: 0, error: "No recipients yet" },
      { status: 200 }
    );
  }

  const from = process.env.RESEND_FROM ?? "Kendrick David <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || noReplyAddress(from);
  const appUrl = getAppUrl();

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((recipient) => {
      const unsubscribeUrl = `${appUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
        createNewsletterUnsubscribeToken(recipient.id)
      )}`;

      return {
        from,
        to: [recipient.email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        html: buildHtml(message, unsubscribeUrl),
        text: buildText(message, unsubscribeUrl),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    try {
      const res = await fetch(RESEND_BATCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emails),
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

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return NextResponse.json({ sent, failed, recipients: recipients.length });
}
