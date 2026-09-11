import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { findUserById } from "@/lib/db";
import {
  getActiveAnnouncements,
  createAnnouncement,
} from "@/lib/db";

/**
 * GET /api/announcements
 * Return the currently active announcement for the Creed banner.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const announcements = await getActiveAnnouncements(1);
    return NextResponse.json({ success: true, announcements }, { status: 200 });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * Artist-only. Create a new announcement shown as a Creed banner.
 */
export async function POST(req: Request) {
  try {
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
        { error: "Only the artist can make announcements" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const content = String(body?.content ?? "").trim();

    if (!content) {
      return NextResponse.json(
        { error: "Announcement text is required" },
        { status: 400 }
      );
    }
    if (content.length > 200) {
      return NextResponse.json(
        { error: "Announcements must be 200 characters or fewer" },
        { status: 400 }
      );
    }

    const announcement = await createAnnouncement(content);
    if ("error" in announcement) {
      return NextResponse.json(
        { error: announcement.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, announcement },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}