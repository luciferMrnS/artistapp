import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, expirationTime? }
 * Registers the current user's device for web-push notifications.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let body: {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
    const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 }
      );
    }

    const saved = await savePushSubscription(user.userId, {
      endpoint,
      keys: { p256dh, auth },
    });

    return NextResponse.json(
      saved
        ? { success: true }
        : { error: "Could not save subscription yet — the push table may not be set up" },
      { status: saved ? 200 : 503 }
    );
  } catch (error) {
    console.error("Error subscribing to push:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}