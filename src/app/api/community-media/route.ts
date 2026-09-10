import { NextRequest, NextResponse } from "next/server";
import { downloadCommunityImage } from "@/lib/db";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function decodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/**
 * GET /api/community-media?p=<storage path>
 * Proxies a creed image from the private "community-media" bucket so the
 * client only ever sees our own domain and the image never depends on an
 * expiring Supabase sign URL.
 */
export async function GET(req: NextRequest) {
  const path = decodeParam(req.nextUrl.searchParams.get("p") ?? "");

  if (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const { data, error } = await downloadCommunityImage(path);
  if (error || !data || data.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
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