import { NextRequest, NextResponse } from "next/server";
import { downloadAvatarFile } from "@/lib/db";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/**
 * GET /api/avatar?p=<storage path>
 * Proxies an avatar from the Supabase "avatars" bucket so the client only ever
 * sees our own domain. Only paths under the avatars bucket are accepted, so
 * the endpoint can't be used to reach arbitrary storage objects.
 */
export async function GET(req: NextRequest) {
  const path = decodeParam(req.nextUrl.searchParams.get("p") ?? "");

  if (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid avatar path" }, { status: 400 });
  }

  const { data, error } = await downloadAvatarFile(path);
  if (error || !data || data.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await data.arrayBuffer());

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}