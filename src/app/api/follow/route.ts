import { NextRequest, NextResponse } from "next/server";
import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowCounts,
  findUserById,
  isUserRestricted,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * POST /api/follow
 * Follow a user
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (await isUserRestricted(user.userId)) {
      return NextResponse.json(
        { error: "Your account is view-only" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 }
      );
    }

    // Verify the target user exists
    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // A user can only subscribe once — if already subscribed, return the
    // current state without inserting a duplicate row. (The UNIQUE
    // constraint in the DB is the race-condition backstop.)
    const alreadySubscribed = await isFollowing(user.userId, targetUserId);
    if (alreadySubscribed) {
      const counts = await getFollowCounts(targetUserId);
      return NextResponse.json(
        { success: true, following: true, counts, alreadySubscribed: true },
        { status: 200 }
      );
    }

    const result = await followUser(user.userId, targetUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return updated follow status
    const following = await isFollowing(user.userId, targetUserId);
    const counts = await getFollowCounts(targetUserId);

    return NextResponse.json(
      { success: true, following, counts },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error following user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/follow
 * Unfollow a user
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required" },
        { status: 400 }
      );
    }

    const result = await unfollowUser(user.userId, targetUserId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const following = await isFollowing(user.userId, targetUserId);
    const counts = await getFollowCounts(targetUserId);

    return NextResponse.json(
      { success: true, following, counts },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/follow?targetUserId=xxx
 * Check if current user is following a target user + get counts
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("targetUserId");

    if (!targetUserId) {
      // If no targetUserId, return the current user's follow counts
      const counts = await getFollowCounts(user.userId);
      return NextResponse.json(
        { success: true, counts },
        { status: 200 }
      );
    }

    // Verify the target user exists
    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const following = await isFollowing(user.userId, targetUserId);
    const counts = await getFollowCounts(targetUserId);

    return NextResponse.json(
      { success: true, following, counts },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking follow status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
