import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { findUserById, getPushSubscriptionStats } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/alerts/status
 * Artist-only diagnoser: shows whether push is configured correctly and how
 * many devices are actually subscribed. Use this to figure out why a hard
 * alert didn't reach fans.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const fullUser = await findUserById(user.userId);
  if (!fullUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (fullUser.role !== "artist") {
    return NextResponse.json(
      { error: "Only the artist can view alert status" },
      { status: 403 }
    );
  }

  const serverPublic = process.env.VAPID_PUBLIC_KEY ?? "";
  const serverPrivate = process.env.VAPID_PRIVATE_KEY ?? "";
  const nextPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  // The public key the browser subscribed with (inlined at build time from
  // NEXT_PUBLIC_VAPID_PUBLIC_KEY) MUST equal the one the server encrypts with
  // (VAPID_PUBLIC_KEY). A mismatch makes every send fail.
  const publicKeyMatch =
    Boolean(serverPublic && nextPublic) && serverPublic === nextPublic;

  const stats = await getPushSubscriptionStats();

  return NextResponse.json({
    configured: {
      serverPublicKeySet: Boolean(serverPublic),
      serverPrivateKeySet: Boolean(serverPrivate),
      nextPublicKeySet: Boolean(nextPublic),
      publicKeyMatch,
      okay: Boolean(serverPublic && serverPrivate && nextPublic && publicKeyMatch),
    },
    devices: stats,
  });
}