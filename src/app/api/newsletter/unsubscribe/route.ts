import { NextRequest, NextResponse } from "next/server";
import { verifyNewsletterUnsubscribeToken } from "@/lib/server-auth";
import { setNewsletterOptOut } from "@/lib/db";

function page(title: string, message: string, status: number): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#09090b;color:#fafafa;font-family:Arial,sans-serif">
<main style="max-width:440px;padding:32px;text-align:center">
<h1 style="font-size:24px;margin:0 0 12px">${title}</h1>
<p style="color:#a1a1aa;line-height:1.6;margin:0">${message}</p>
</main>
</body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

async function unsubscribe(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token");
  const userId = token ? verifyNewsletterUnsubscribeToken(token) : null;

  if (!userId) {
    return page(
      "Invalid link",
      "This unsubscribe link is invalid or has expired.",
      400
    );
  }

  const updated = await setNewsletterOptOut(userId, true);
  if (!updated) {
    return page(
      "Something went wrong",
      "We couldn't update your preferences. Please try again later.",
      500
    );
  }

  return page(
    "Unsubscribed",
    "You won't receive newsletter emails from this site anymore.",
    200
  );
}

export async function GET(req: NextRequest) {
  return unsubscribe(req);
}

export async function POST(req: NextRequest) {
  return unsubscribe(req);
}
