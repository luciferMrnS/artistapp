/**
 * Supabase Database Module
 * Manages user storage, posts, likes, comments, and follows
 * Phase 4: Likes, Comments & Follow functionality
 */

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ─── User ───────────────────────────────────────────

export type UserRole = "artist" | "fan";

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  password_hash: string | null; // Legacy bcrypt hash; null for Supabase Auth accounts
  avatar: string;
  role: UserRole;
  supabase_auth_id?: string | null;
  email_verified?: boolean;
  created_at: string;
}

/**
 * Get user's public data (without password hash)
 */
export function getUserPublicData(
  user: StoredUser
): Omit<StoredUser, "password_hash"> {
  const { password_hash, ...publicData } = user;
  return publicData;
}

// ─── Post ───────────────────────────────────────────

export interface Post {
  id: string;
  author_id: string;
  content: string;
  image: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface PostWithAuthor extends Post {
  author: {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
  };
}

// ─── Like ───────────────────────────────────────────

export interface Like {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

// ─── Comment ─────────────────────────────────────────

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
  };
}

// ─── Follow ─────────────────────────────────────────

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// ─── Notification ───────────────────────────────────

export type NotificationType = "like" | "comment" | "follow" | "post";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  post_id: string | null;
  read: boolean;
  created_at: string;
}

export interface NotificationWithActor extends Notification {
  actor: {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
  } | null;
}

// ─── Supabase Clients ──────────────────────────────

// Placeholder values keep module import side-effect free: `next build` imports
// route modules to collect their config, and at that point host secrets may
// not be injected yet (Render/Vercel can keep them runtime-only). No query runs
// during build collection, so a stub client is never used there; the real
// process.env is read in the running server process, which always has the keys.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Server-side client - use SERVICE_ROLE_KEY for admin operations
const supabaseAdmin = createClient(
  SUPABASE_URL || "https://missing-config.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY || "no-key"
);

// Regular client - use ANON_KEY for auth operations
const supabase = createClient(
  SUPABASE_URL || "https://missing-config.supabase.co",
  SUPABASE_ANON_KEY || "no-key"
);

// ─── Table-missing helper ─────────────────────────────
// Features whose tables come from a not-yet-applied migration
// degrade gracefully instead of breaking their callers.

function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message ?? "").toLowerCase().includes("could not find the table")
  );
}

// ─── Post Counter Helper ─────────────────────────────

/**
 * Atomically increment/decrement a numeric column on a post
 * Uses a Postgres RPC function to avoid race conditions.
 * Falls back to read-then-update if the RPC doesn't exist yet.
 */
async function incrementPostCounter(
  postId: string,
  column: "likes_count" | "comments_count",
  amount: 1 | -1
): Promise<void> {
  // Try the RPC function first
  const { error } = await supabaseAdmin.rpc("increment_post_counter", {
    post_id: postId,
    col_name: column,
    increment: amount,
  });

  if (error) {
    // Fallback: read-then-update (race-prone but works for demos)
    const { data: post } = await supabaseAdmin
      .from("posts")
      .select(column)
      .eq("id", postId)
      .single();

    if (post) {
      const currentValue = Number((post as Record<string, unknown>)[column]) || 0;
      await supabaseAdmin
        .from("posts")
        .update({ [column]: currentValue + amount })
        .eq("id", postId);
    }
  }
}

// ─── User Functions ─────────────────────────────────

/**
 * Find user by email - queries Supabase
 */
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // No rows found
      console.error("Error finding user:", error);
      return null;
    }

    return data as StoredUser;
  } catch (err) {
    console.error("Database error:", err);
    return null;
  }
}

/**
 * Find user by ID - queries Supabase
 */
export async function findUserById(id: string): Promise<StoredUser | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // No rows found
      console.error("Error finding user:", error);
      return null;
    }

    return data as StoredUser;
  } catch (err) {
    console.error("Database error:", err);
    return null;
  }
}

/**
 * Create an app profile row for a Supabase Auth user that has not yet
 * confirmed their email. Password lives in Supabase Auth from now on —
 * only profile data is stored here.
 */
export async function createUnverifiedUser({
  email,
  username,
  role,
  supabaseAuthId,
}: {
  email: string;
  username: string;
  role: UserRole;
  supabaseAuthId: string;
}): Promise<StoredUser | { error: string }> {
  try {
    const newUser: StoredUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase(),
      username,
      // Legacy column — password lives in Supabase Auth for this account.
      // Empty string (NOT a bcrypt hash) keeps the legacy login path from
      // ever treating it as a usable password.
      password_hash: "",
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
      role,
      supabase_auth_id: supabaseAuthId,
      email_verified: false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert([newUser])
      .select()
      .single();

    if (error) {
      console.error("Error creating unverified user:", error.message);
      return { error: error.message || "Failed to create user" };
    }

    return data as StoredUser;
  } catch (err) {
    console.error("Database error:", err);
    return { error: err instanceof Error ? err.message : "Database error" };
  }
}

/**
 * Mark a user's email as verified (after Supabase confirmation) and link
 * the Supabase Auth account. Returns the updated row.
 */
export async function markEmailVerified(
  email: string,
  supabaseAuthId?: string
): Promise<StoredUser | null> {
  const update: Record<string, unknown> = { email_verified: true };
  if (supabaseAuthId) update.supabase_auth_id = supabaseAuthId;

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(update)
    .eq("email", email.toLowerCase())
    .select()
    .single();

  if (error) {
    console.error("Error marking email verified:", error.message);
    return null;
  }

  return data as StoredUser;
}

/**
 * Verify password
 */
export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Check whether a username is already taken by ANOTHER user
 * (case-insensitive comparison)
 */
export async function isUsernameTaken(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  let query = supabaseAdmin
    .from("users")
    .select("id")
    .ilike("username", username);

  if (excludeUserId) query = query.neq("id", excludeUserId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Error checking username:", error);
    return false;
  }

  return !!data;
}

/**
 * Update a user's profile fields (username, avatar)
 * Returns the updated row or null on failure
 */
export async function updateUserProfile(
  userId: string,
  updates: { username?: string; avatar?: string }
): Promise<StoredUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating user profile:", error.message);
    return null;
  }

  return data as StoredUser;
}

/**
 * Update the password of a legacy (bcrypt-hashed) account, e.g. the seeded
 * artist that never had a Supabase Auth identity
 */
export async function updateLegacyUserPassword(
  userId: string,
  newPassword: string
): Promise<StoredUser | null> {
  const password_hash = await bcrypt.hash(newPassword, 10);

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ password_hash })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating legacy password:", error.message);
    return null;
  }

  return data as StoredUser;
}

/**
 * Update the password of a Supabase Auth account via the Admin API
 */
export async function updateSupabaseAuthPassword(
  supabaseAuthId: string,
  newPassword: string
): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    supabaseAuthId,
    { password: newPassword }
  );

  if (error) {
    console.error("Error updating Supabase Auth password:", error.message);
    return false;
  }

  return true;
}

// ─── Password-change confirmation tokens ──────────────
// A logged-in user stages a new password; the change only applies
// after they click the email confirmation link (Supabase password
// recovery). The staged password is encrypted at rest so the plaintext
// never touches the database.

export interface PasswordChangeToken {
  id: string;
  user_id: string;
  new_password_enc: string;
  expires_at: string;
  consumed: boolean;
  created_at: string;
}

const PASSWORD_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getTokenEncryptionKey(): Buffer {
  const secret =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptNewPassword(plain: string): string {
  const key = getTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

function decryptNewPassword(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const key = getTokenEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Stage a password change — encrypts the new password and stores a
 * single-use token valid for 30 minutes. Returns the token row.
 */
export async function createPasswordChangeToken(
  userId: string,
  newPassword: string
): Promise<PasswordChangeToken | { error: string }> {
  const id = `pwr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const token = {
    id,
    user_id: userId,
    new_password_enc: encryptNewPassword(newPassword),
    expires_at: new Date(Date.now() + PASSWORD_TOKEN_TTL_MS).toISOString(),
    consumed: false,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("password_change_tokens")
    .insert([token])
    .select()
    .single();

  if (error) {
    console.error("Error staging password change:", error.message);
    return { error: error.message || "Failed to stage password change" };
  }

  return data as PasswordChangeToken;
}

/**
 * Fetch the latest valid (unexpired, unconsumed) pending password change
 * for a user, if any.
 */
export async function getPendingPasswordChange(
  userId: string
): Promise<PasswordChangeToken | null> {
  const { data, error } = await supabaseAdmin
    .from("password_change_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error reading pending password change:", error.message);
    return null;
  }

  return data as PasswordChangeToken | null;
}

/** Recover the staged plaintext password from a pending change token. */
export function getPasswordChangePlaintext(
  token: PasswordChangeToken
): string {
  return decryptNewPassword(token.new_password_enc);
}

/** Mark a staged password change as used. */
export async function consumePasswordChangeToken(
  tokenId: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("password_change_tokens")
    .update({ consumed: true })
    .eq("id", tokenId);

  if (error) {
    console.error("Error consuming password change token:", error.message);
    return false;
  }

  return true;
}

/** Delete all pending password changes for a user (cleanup / cancel). */
export async function deletePasswordChangeTokens(
  userId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("password_change_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error clearing password change tokens:", error.message);
  }
}

// ─── Post Functions ─────────────────────────────────

/**
 * Get all posts with author info, most recent first
 */
export async function getAllPosts(): Promise<PostWithAuthor[]> {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(`
      *,
      author:users!posts_author_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  return data as unknown as PostWithAuthor[];
}

/**
 * Get posts by author ID
 */
export async function getPostsByAuthor(
  authorId: string
): Promise<PostWithAuthor[]> {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(`
      *,
      author:users!posts_author_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  return data as unknown as PostWithAuthor[];
}

/**
 * Get a single post by ID with author info
 */
export async function getPostById(id: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabaseAdmin
    .from("posts")
    .select(`
      *,
      author:users!posts_author_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching post:", error);
    return null;
  }

  return data as unknown as PostWithAuthor;
}

/**
 * Create a new post (artist only)
 */
export async function createPost(
  authorId: string,
  content: string,
  image: string | null = null
): Promise<Post | { error: string }> {
  const newPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    author_id: authorId,
    content,
    image,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("posts")
    .insert([newPost])
    .select()
    .single();

  if (error) {
    console.error("Error creating post:", error);
    return { error: error.message || "Failed to create post" };
  }

  // Notify all followers about the new post (best-effort)
  const followers = await getFollowers(authorId);
  const followerIds = (
    followers as Array<{ follower: { id: string } }>
  )
    .map((f) => f.follower.id)
    .filter((id) => id !== authorId);
  for (const followerId of followerIds) {
    await createNotification(followerId, "post", authorId, data.id);
  }

  return data as Post;
}

/**
 * Delete a post and its image (artist only — enforced by the caller).
 * Likes, comments, and notifications cascade via their FKs.
 */
export async function deletePost(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const post = await getPostById(postId);
  if (!post) return { success: false, error: "Post not found" };

  // If the image is one of our public-bucket uploads, remove the file too
  if (post.image?.includes(`/${POST_IMAGES_BUCKET}/`)) {
    const storagePath = post.image
      .split(`/${POST_IMAGES_BUCKET}/`)[1]
      ?.split("?")[0];
    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(POST_IMAGES_BUCKET)
        .remove([storagePath]);
      if (storageError) {
        console.error("Error removing post image:", storageError);
      }
    }
  }

  const { error } = await supabaseAdmin.from("posts").delete().eq("id", postId);

  if (error) {
    console.error("Error deleting post:", error);
    return { success: false, error: error.message || "Failed to delete post" };
  }

  return { success: true };
}
// Post images live in a PUBLIC bucket so they render permanently
// in the feed (unlike chat media, which uses expiring signed URLs).

export const POST_IMAGES_BUCKET = "post-images";

/**
 * Make sure the public post-images bucket exists.
 * Idempotent — safe to call before every upload.
 */
export async function ensurePostImagesBucket(): Promise<boolean> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some((b) => b.name === POST_IMAGES_BUCKET)) return true;

  const { error } = await supabaseAdmin.storage.createBucket(POST_IMAGES_BUCKET, {
    public: true,
  });

  if (error) {
    console.error("Error creating post-images bucket:", error);
    return false;
  }

  return true;
}

/**
 * Upload an image for a post and return its permanent public URL.
 */
export async function uploadPostImage(
  userId: string,
  file: File
): Promise<{ publicUrl: string | null; error?: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(POST_IMAGES_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Error uploading post image:", error);
    return { publicUrl: null, error: error.message || "Failed to upload image" };
  }

  const { data } = supabaseAdmin.storage
    .from(POST_IMAGES_BUCKET)
    .getPublicUrl(path);

  return { publicUrl: data.publicUrl };
}

// ─── Avatar Upload ──────────────────────────────
// Profile pictures live in a PUBLIC bucket so they render permanently
// on posts, comments, and the feed. Uploads work for both artists and fans.

export const AVATARS_BUCKET = "avatars";

/**
 * Make sure the public avatars bucket exists.
 * Idempotent — safe to call before every upload.
 */
export async function ensureAvatarsBucket(): Promise<boolean> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some((b) => b.name === AVATARS_BUCKET)) return true;

  const { error } = await supabaseAdmin.storage.createBucket(AVATARS_BUCKET, {
    public: true,
  });

  if (error) {
    console.error("Error creating avatars bucket:", error);
    return false;
  }

  return true;
}

/**
 * Upload a profile picture and return its permanent public URL.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ publicUrl: string | null; error?: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(AVATARS_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Error uploading avatar:", error);
    return { publicUrl: null, error: error.message || "Failed to upload image" };
  }

  const { data } = supabaseAdmin.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);

  return { publicUrl: data.publicUrl };
}

// ─── Theme Media ──────────────────────────────────────
// Themed drop media (new-drop / behind-the-scenes / studio)
// lives in a PUBLIC bucket so browser audio/video/photo
// playback works directly from the public URL.

export const THEME_MEDIA_BUCKET = "theme-media";

export type ThemeSlug = "new-drop" | "behind-the-scenes" | "studio";
export type MediaType = "audio" | "video" | "photo";

export interface ThemeMedia {
  id: string;
  theme: ThemeSlug;
  media_type: MediaType;
  title: string;
  caption: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ThemeMediaItem extends ThemeMedia {
  media_url: string;
}

/**
 * Make sure the public theme-media bucket exists.
 * Idempotent — safe to call before every upload.
 */
export async function ensureThemeMediaBucket(): Promise<boolean> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some((b) => b.name === THEME_MEDIA_BUCKET)) return true;

  const { error } = await supabaseAdmin.storage.createBucket(THEME_MEDIA_BUCKET, {
    public: true,
  });

  if (error) {
    console.error("Error creating theme-media bucket:", error);
    return false;
  }

  return true;
}

/**
 * Upload themed media (audio/video/photo) and persist its row.
 * The uploaded file is removed again if the row insert fails.
 */
export async function uploadThemeMedia(params: {
  theme: ThemeSlug;
  mediaType: MediaType;
  title: string;
  caption: string;
  file: File;
}): Promise<{ item?: ThemeMediaItem; error?: string }> {
  const { theme, mediaType, title, caption, file } = params;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = `tm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const path = `${theme}/${id}_${safeName}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from(THEME_MEDIA_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (storageError) {
    console.error("Error uploading theme media:", storageError);
    return {
      error: storageError.message || "Failed to upload file",
    };
  }

  const row = {
    id,
    theme,
    media_type: mediaType,
    title,
    caption,
    storage_path: path,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("theme_media")
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error("Error inserting theme media:", error);
    // Clean up the orphaned file so the storage bucket stays tidy
    await supabaseAdmin.storage.from(THEME_MEDIA_BUCKET).remove([path]);
    if (isTableMissing(error)) {
      return { error: "Theme media is not set up yet" };
    }
    return { error: error.message || "Failed to save media" };
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(THEME_MEDIA_BUCKET)
    .getPublicUrl(path);

  return {
    item: { ...(data as ThemeMedia), media_url: urlData.publicUrl },
  };
}

/**
 * List media for a theme (newest first)
 */
export async function getThemeMedia(theme: ThemeSlug): Promise<ThemeMediaItem[]> {
  const { data, error } = await supabaseAdmin
    .from("theme_media")
    .select("*")
    .eq("theme", theme)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissing(error)) return [];
    console.error("Error fetching theme media:", error);
    return [];
  }

  return ((data ?? []) as ThemeMedia[]).map((row) => ({
    ...row,
    media_url: supabaseAdmin.storage
      .from(THEME_MEDIA_BUCKET)
      .getPublicUrl(row.storage_path).data.publicUrl,
  }));
}

// ─── Like Functions ─────────────────────────────────

/**
 * Like a post
 */
export async function likePost(
  postId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const newLike = {
    id: `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    post_id: postId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("likes").insert([newLike]);

  if (error) {
    // Duplicate like is not fatal — just a no-op
    if (error.code === "23505") return { success: true };
    console.error("Error liking post:", error);
    return { success: false, error: error.message || "Failed to like post" };
  }

  await incrementPostCounter(postId, "likes_count", 1);

  // Notify the post author (best-effort)
  const post = await getPostById(postId);
  if (post && post.author_id !== userId) {
    await createNotification(post.author_id, "like", userId, postId);
  }

  return { success: true };
}

/**
 * Unlike a post (remove like)
 */
export async function unlikePost(
  postId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error unliking post:", error);
    return { success: false, error: error.message || "Failed to unlike post" };
  }

  await incrementPostCounter(postId, "likes_count", -1);
  return { success: true };
}

/**
 * Check if a user has liked a post
 */
export async function hasUserLikedPost(
  postId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking like:", error);
    return false;
  }

  return !!data;
}

/**
 * Like-status for a whole feed in a single query — returns the Set of
 * post ids the user has liked (replaces an N+1 loop of hasUserLikedPost).
 */
export async function getUserLikedPostIds(
  userId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from("likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) {
    console.error("Error checking liked posts:", error);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.post_id));
}

/**
 * Get likes for a post (with user info)
 */
export async function getLikesForPost(postId: string) {
  const { data, error } = await supabaseAdmin
    .from("likes")
    .select(`
      *,
      user:users!likes_user_id_fkey (
        id,
        username,
        avatar
      )
    `)
    .eq("post_id", postId);

  if (error) {
    console.error("Error fetching likes:", error);
    return [];
  }

  return data;
}

// ─── Comment Functions ─────────────────────────────

/**
 * Get all comments for a post (with author info)
 */
export async function getCommentsForPost(
  postId: string
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select(`
      *,
      author:users!comments_user_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  return data as unknown as CommentWithAuthor[];
}

/**
 * Create a comment on a post
 */
export async function createComment(
  postId: string,
  userId: string,
  content: string
): Promise<Comment | { error: string }> {
  const newComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    post_id: postId,
    user_id: userId,
    content,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert([newComment])
    .select()
    .single();

  if (error) {
    console.error("Error creating comment:", error);
    return { error: error.message || "Failed to create comment" };
  }

  await incrementPostCounter(postId, "comments_count", 1);

  // Notify the post author (best-effort)
  const post = await getPostById(postId);
  if (post && post.author_id !== userId) {
    await createNotification(post.author_id, "comment", userId, postId);
  }

  return data as Comment;
}

/**
 * Delete a comment (only the comment author)
 */
export async function deleteComment(
  commentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting comment:", error);
    return { success: false, error: error.message || "Failed to delete comment" };
  }

  return { success: true };
}

// ─── Follow Functions ─────────────────────────────

/**
 * Follow a user
 */
export async function followUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  if (followerId === followingId) {
    return { success: false, error: "Cannot follow yourself" };
  }

  const newFollow = {
    id: `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    follower_id: followerId,
    following_id: followingId,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("follows").insert([newFollow]);

  if (error) {
    if (error.code === "23505") return { success: true }; // Already following
    console.error("Error following user:", error);
    return { success: false, error: error.message || "Failed to follow user" };
  }

  // Notify the followed user (best-effort)
  await createNotification(followingId, "follow", followerId, null);

  return { success: true };
}

/**
 * Unfollow a user
 */
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) {
    console.error("Error unfollowing user:", error);
    return { success: false, error: error.message || "Failed to unfollow" };
  }

  return { success: true };
}

/**
 * Check if a user is following another user
 */
export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (error) {
    console.error("Error checking follow status:", error);
    return false;
  }

  return !!data;
}

/**
 * Get follow counts for a user (followers and following)
 */
export async function getFollowCounts(userId: string): Promise<{
  followers: number;
  following: number;
}> {
  const [followersResult, followingResult] = await Promise.all([
    supabaseAdmin
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabaseAdmin
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
  };
}

/**
 * Get followers of a user (with user info)
 */
export async function getFollowers(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("follows")
    .select(`
      *,
      follower:users!follows_follower_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .eq("following_id", userId);

  if (error) {
    console.error("Error fetching followers:", error);
    return [];
  }

  return data;
}

/**
 * Get users that a user is following (with user info)
 */
export async function getFollowing(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("follows")
    .select(`
      *,
      following:users!follows_following_id_fkey (
        id,
        username,
        avatar,
        role
      )
    `)
    .eq("follower_id", userId);

  if (error) {
    console.error("Error fetching following:", error);
    return [];
  }

  return data;
}

// ─── Notification Functions ─────────────────────────
// Best-effort: if the notifications table doesn't exist yet,
// these fail silently so like/comment/follow/post flows still work.

/**
 * Create a notification (best-effort, never throws)
 */
async function createNotification(
  userId: string,
  type: NotificationType,
  actorId: string | null,
  postId: string | null
): Promise<void> {
  try {
    if (!userId) return;
    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      type,
      actor_id: actorId,
      post_id: postId,
      read: false,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin
      .from("notifications")
      .insert([newNotification]);
    if (error) console.error("Error creating notification:", error);
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Get notifications for a user (newest first) with actor info
 */
export async function getNotifications(
  userId: string,
  limit = 50
): Promise<{ notifications: NotificationWithActor[]; unreadCount: number }> {
  const [listResult, countResult] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select(`
        *,
        actor:users!notifications_actor_id_fkey (
          id,
          username,
          avatar,
          role
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false),
  ]);

  if (listResult.error) {
    console.error("Error fetching notifications:", listResult.error);
    return { notifications: [], unreadCount: 0 };
  }

  return {
    notifications: (listResult.data as unknown as NotificationWithActor[]) ?? [],
    unreadCount: countResult.count ?? 0,
  };
}

/**
 * Unread notification count for the sidebar badge
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Mark a single notification (or all) as read
 */
export async function markNotificationsRead(
  userId: string,
  id?: string
): Promise<{ success: boolean }> {
  try {
    let query = supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId);
    if (id) query = query.eq("id", id);

    const { error } = await query;
    if (error) {
      // Table doesn't exist yet (migration not applied) — treat as no-op
      if (isTableMissing(error)) return { success: true };
      console.error("Error marking notifications read:", error);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to mark notifications read:", err);
    return { success: false };
  }
}

/**
 * Get the artist user (for seeding/identification)
 */
export async function getArtistUser(): Promise<StoredUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("role", "artist")
    .single();

  if (error) {
    console.error("Error fetching artist:", error);
    return null;
  }

  return data as StoredUser;
}

// ─── Track / Stream ─────────────────────────────────
// Music streaming: the artist uploads audio to the private
// "tracks" storage bucket; fans stream it via short-lived
// signed URLs. Monthly listeners = distinct users who
// started a stream in the last 30 days.

export const TRACKS_BUCKET = "tracks";

export interface Track {
  id: string;
  artist_id: string;
  title: string;
  storage_path: string;
  /** Path to the optional album cover inside TRACKS_BUCKET (private) */
  cover_path: string | null;
  plays_count: number;
  created_at: string;
}

export interface TrackWithSignedUrl extends Track {
  /** Short-lived signed URL for streaming — never expose storage_path */
  audio_url: string | null;
  /** Short-lived signed URL for the album cover, if one exists */
  cover_url: string | null;
}

/**
 * Create a track record (the audio file must already be uploaded
 * to the TRACKS_BUCKET storage bucket by the caller)
 */
export async function createTrack(
  artistId: string,
  title: string,
  storagePath: string,
  coverPath?: string | null
): Promise<Track | { error: string }> {
  const newTrack: Record<string, unknown> = {
    id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    artist_id: artistId,
    title,
    storage_path: storagePath,
    plays_count: 0,
    created_at: new Date().toISOString(),
  };

  // Only set cover_path when a cover was provided — this keeps the
  // insert compatible before the phase-11 migration has been applied.
  if (coverPath) {
    newTrack.cover_path = coverPath;
  }

  const { data, error } = await supabaseAdmin
    .from("tracks")
    .insert([newTrack])
    .select()
    .single();

  if (error) {
    console.error("Error creating track:", error);
    return { error: error.message || "Failed to create track" };
  }

  return data as Track;
}

/**
 * Get all tracks, newest first
 */
export async function getTracks(): Promise<Track[]> {
  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tracks:", error);
    return [];
  }

  return data as Track[];
}

/**
 * Get a single track by ID
 */
export async function getTrackById(id: string): Promise<Track | null> {
  const { data, error } = await supabaseAdmin
    .from("tracks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Error fetching track:", error);
    return null;
  }

  return data as Track;
}

/**
 * Upload an audio file to the private tracks bucket
 */
export async function uploadTrackFile(
  path: string,
  body: Buffer,
  contentType: string
): Promise<{ error: { message: string } | null }> {
  return supabaseAdmin.storage.from(TRACKS_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
  });
}

/**
 * Remove an audio file from the tracks bucket (cleanup on failure)
 */
export async function removeTrackFile(path: string): Promise<void> {
  await supabaseAdmin.storage.from(TRACKS_BUCKET).remove([path]);
}

/**
 * Delete a track: removes the audio (and cover) from the private bucket,
 * then deletes the row. Stream records cascade via their FK.
 * Artist-only ownership is enforced by the caller.
 */
export async function deleteTrack(
  trackId: string
): Promise<{ success: boolean; error?: string }> {
  const track = await getTrackById(trackId);
  if (!track) return { success: false, error: "Track not found" };

  const paths = [track.storage_path];
  if (track.cover_path) paths.push(track.cover_path);

  const { error: storageError } = await supabaseAdmin.storage
    .from(TRACKS_BUCKET)
    .remove(paths);
  if (storageError) {
    console.error("Error removing track files:", storageError);
  }

  const { error } = await supabaseAdmin
    .from("tracks")
    .delete()
    .eq("id", trackId);

  if (error) {
    console.error("Error deleting track:", error);
    return { success: false, error: error.message || "Failed to delete track" };
  }

  return { success: true };
}

/**
 * Create a short-lived signed URL for streaming a track.
 * Private bucket + expiring URL keeps the audio from being
 * permanently linked or downloaded.
 */
export async function getTrackSignedUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(TRACKS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Attach signed streaming URLs to a list of tracks.
 * Album covers get the same short-lived treatment.
 */
export async function getTracksWithSignedUrls(
  expiresIn = 3600
): Promise<TrackWithSignedUrl[]> {
  const tracks = await getTracks();

  return Promise.all(
    tracks.map(async (track) => ({
      ...track,
      audio_url: await getTrackSignedUrl(track.storage_path, expiresIn),
      // Pre-migration the column is absent: cover_path is undefined → no cover
      cover_url: track.cover_path
        ? await getTrackSignedUrl(track.cover_path, expiresIn)
        : null,
    }))
  );
}

/**
 * Atomically increment a track's play counter.
 * Uses the RPC first; falls back to read-then-update.
 */
export async function incrementTrackPlays(trackId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("increment_track_plays", {
    p_track_id: trackId,
  });

  if (!error) return;

  // Fallback if the RPC doesn't exist yet
  const { data: current, error: fetchError } = await supabaseAdmin
    .from("tracks")
    .select("plays_count")
    .eq("id", trackId)
    .single();

  if (fetchError || !current) {
    console.error("Error reading track plays:", fetchError);
    return;
  }

  await supabaseAdmin
    .from("tracks")
    .update({ plays_count: current.plays_count + 1 })
    .eq("id", trackId);
}

/**
 * Record that a user started streaming a track
 */
export async function recordStream(
  trackId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const track = await getTrackById(trackId);
  if (!track) return { success: false, error: "Track not found" };

  const newStream = {
    id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    track_id: trackId,
    artist_id: track.artist_id,
    user_id: userId,
    played_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("streams").insert([newStream]);

  if (error) {
    console.error("Error recording stream:", error);
    return { success: false, error: error.message || "Failed to record stream" };
  }

  await incrementTrackPlays(trackId);
  return { success: true };
}

/**
 * Monthly listeners: distinct users who streamed this artist's
 * tracks within the last N days (default 30).
 * Uses the RPC first; falls back to fetching and deduping.
 */
export async function getMonthlyListeners(
  artistId: string,
  days = 30
): Promise<number> {
  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    "get_monthly_listeners",
    { p_artist_id: artistId, p_days: days }
  );

  if (!rpcError && rpcData !== null) {
    return Number(rpcData) || 0;
  }

  // Fallback: fetch user_ids in the window and dedupe in JS
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("streams")
    .select("user_id")
    .eq("artist_id", artistId)
    .gte("played_at", since);

  if (error) {
    console.error("Error fetching monthly listeners:", error);
    return 0;
  }

  return new Set((data ?? []).map((row) => row.user_id)).size;
}

// ─── Presence (fans online) ────────────────────────────
// Last-seen heartbeats power the live "fans online" count.
// A user counts as online while their heartbeat is fresher than
// the window below. Migrated by `database/migration_fans_online.sql`.

/** How recent a heartbeat must be for a user to count as online */
export const PRESENCE_ONLINE_WINDOW_SECONDS = 60;
/** Heartbeats older than this get swept on the next touch (keeps the table lean) */
export const PRESENCE_SWEEP_SECONDS = 5 * 60;

/**
 * Upsert a "still here" heartbeat for the given user and opportunistically
 * sweep stale rows. Returns false (silently) if the table hasn't been
 * migrated yet — the UI then just shows 0.
 */
export async function touchPresence(userId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from("user_presence").upsert(
      { user_id: userId, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) {
      if (isTableMissing(error)) return false;
      console.error("Error touching presence:", error);
      return false;
    }

    const sweepCutoff = new Date(
      Date.now() - PRESENCE_SWEEP_SECONDS * 1000
    ).toISOString();
    await supabaseAdmin
      .from("user_presence")
      .delete()
      .lt("last_seen_at", sweepCutoff);

    return true;
  } catch {
    return false;
  }
}

/**
 * Count distinct fans whose heartbeat is still inside the online window.
 * Fans only — the artist's own presence (or any non-fan) never counts,
 * which keeps the number honest.
 */
export async function countFansOnline(): Promise<number> {
  try {
    const cutoff = new Date(
      Date.now() - PRESENCE_ONLINE_WINDOW_SECONDS * 1000
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("user_presence")
      .select("users!inner(role)")
      .gt("last_seen_at", cutoff)
      .eq("users.role", "fan");

    if (error) {
      if (isTableMissing(error)) return 0;
      console.error("Error counting fans online:", error);
      return 0;
    }

    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

// ─── Artist Dashboard ─────────────────────────────────
// Stats & leaderboard for the artist's dashboard page.

export interface FanEngagement {
  user_id: string;
  username: string;
  avatar: string;
  likes: number;
  comments: number;
  total: number;
}

export interface ArtistStats {
  followerCount: number;
  monthlyListeners: number;
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  totalTrackPlays: number;
  topFans: FanEngagement[];
  posts: PostWithAuthor[];
}

/**
 * Aggregate the artist's stats: follower/stream numbers, post
 * totals, engagement rate, track plays, and the top-fans
 * leaderboard (ranked by likes + comments across all posts).
 */
export async function getArtistStats(): Promise<ArtistStats | null> {
  const artist = await getArtistUser();
  if (!artist) return null;

  const [posts, followCounts, monthlyListeners, tracks, likeResult, commentResult] =
    await Promise.all([
      getAllPosts(),
      getFollowCounts(artist.id),
      getMonthlyListeners(artist.id),
      getTracks(),
      supabaseAdmin.from("likes").select(`
        user_id,
        user:users!likes_user_id_fkey (id, username, avatar, role)
      `),
      supabaseAdmin.from("comments").select(`
        user_id,
        author:users!comments_user_id_fkey (id, username, avatar, role)
      `),
    ]);

  const totalLikes = posts.reduce((sum, post) => sum + post.likes_count, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments_count, 0);
  const totalTrackPlays = tracks.reduce((sum, track) => sum + track.plays_count, 0);
  const engagementRate =
    followCounts.followers > 0
      ? ((totalLikes + totalComments) / followCounts.followers) * 100
      : 0;

  // Aggregate fan engagement from likes + comments
  const fanStats = new Map<string, FanEngagement>();
  const bumpFan = (
    userId: string,
    username: string,
    avatar: string,
    role: string,
    likesDelta: number,
    commentsDelta: number
  ) => {
    if (!userId || role === "artist") return;
    const existing = fanStats.get(userId);
    if (existing) {
      existing.likes += likesDelta;
      existing.comments += commentsDelta;
      existing.total += likesDelta + commentsDelta;
    } else {
      fanStats.set(userId, {
        user_id: userId,
        username,
        avatar,
        likes: likesDelta,
        comments: commentsDelta,
        total: likesDelta + commentsDelta,
      });
    }
  };

  for (const like of likeResult.data ?? []) {
    const u = like.user as unknown as
      | { id: string; username: string; avatar: string; role: string }
      | null;
    if (!u) continue;
    bumpFan(u.id, u.username, u.avatar, u.role, 1, 0);
  }
  for (const comment of commentResult.data ?? []) {
    const u = comment.author as unknown as
      | { id: string; username: string; avatar: string; role: string }
      | null;
    if (!u) continue;
    bumpFan(u.id, u.username, u.avatar, u.role, 0, 1);
  }

  const topFans = [...fanStats.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((fan) => ({ ...fan, avatar: fan.avatar || "/default-avatar.png" }));

  return {
    followerCount: followCounts.followers,
    monthlyListeners,
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    engagementRate,
    totalTrackPlays,
    topFans,
    posts,
  };
}

// ─── Direct Messages ────────────────────────────────
// One-to-one DMs (fan-artist / fan-fan). Single table with a
// deterministic conversation_id (sorted participant ids) so no
// separate conversations table is needed. Missing-table safe.

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  media_url: string | null;
  read: boolean;
  created_at: string;
}

export interface ConversationSummary {
  conversation_id: string;
  other_user: {
    id: string;
    username: string;
    avatar: string;
    role: UserRole;
  };
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
}

function deriveConversationId(a: string, b: string): string {
  const [low, high] = a < b ? [a, b] : [b, a];
  return `dm_${low}_${high}`;
}

/**
 * Send a direct message (creates the conversation implicitly)
 */
export async function sendDirectMessage(
  senderId: string,
  recipientId: string,
  content: string,
  mediaUrl: string | null = null
): Promise<{
  success: boolean;
  message?: DirectMessage;
  conversationId?: string;
  error?: string;
}> {
  try {
    if (senderId === recipientId) {
      return { success: false, error: "Cannot message yourself" };
    }
    if (!content.trim() && !mediaUrl) {
      return { success: false, error: "Message is empty" };
    }

    const conversationId = deriveConversationId(senderId, recipientId);
    const newMessage = {
      id: `dm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
      content,
      media_url: mediaUrl,
      read: false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("direct_messages")
      .insert([newMessage])
      .select()
      .single();

    if (error) {
      if (isTableMissing(error)) {
        return { success: false, error: "Direct messages are not set up yet" };
      }
      console.error("Error sending DM:", error);
      return { success: false, error: error.message || "Failed to send message" };
    }

    return { success: true, message: data as DirectMessage, conversationId };
  } catch (err) {
    console.error("Failed to send DM:", err);
    return { success: false, error: "Failed to send message" };
  }
}

/**
 * List the user's conversations (latest message per conversation,
 * with the other participant's profile and unread count)
 */
export async function getConversations(
  userId: string
): Promise<ConversationSummary[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isTableMissing(error)) return [];
      console.error("Error fetching conversations:", error);
      return [];
    }

    const messages = (data ?? []) as DirectMessage[];

    // Latest message per conversation + unread tallies
    const latestByConversation = new Map<string, DirectMessage>();
    const unreadByConversation: Record<string, number> = {};
    for (const msg of messages) {
      if (msg.recipient_id === userId && !msg.read) {
        unreadByConversation[msg.conversation_id] =
          (unreadByConversation[msg.conversation_id] ?? 0) + 1;
      }
      if (!latestByConversation.has(msg.conversation_id)) {
        latestByConversation.set(msg.conversation_id, msg);
      }
    }

    // Resolve the other participant's profile for each conversation
    const otherIds = [...latestByConversation.values()].map((m) =>
      m.sender_id === userId ? m.recipient_id : m.sender_id
    );
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, username, avatar, role")
      .in("id", otherIds);
    if (usersError) {
      console.error("Error fetching conversation users:", usersError);
    }
    const userById = new Map(
      ((users as Array<{ id: string; username: string; avatar: string; role: string }>) ?? []).map(
        (u) => [u.id, u]
      )
    );

    return [...latestByConversation.values()].map((msg) => {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      const other = userById.get(otherId);
      return {
        conversation_id: msg.conversation_id,
        other_user: {
          id: other?.id ?? "",
          username: other?.username ?? "Unknown",
          avatar: other?.avatar ?? "/default-avatar.png",
          role: (other?.role as UserRole) ?? "fan",
        },
        last_message: msg.media_url ? "[image]" : msg.content,
        last_message_at: msg.created_at,
        last_sender_id: msg.sender_id,
        unread_count: unreadByConversation[msg.conversation_id] ?? 0,
      };
    });
  } catch (err) {
    console.error("Failed to fetch conversations:", err);
    return [];
  }
}

/**
 * Get the messages in a conversation (only if the user is a participant)
 */
export async function getDirectMessages(
  conversationId: string,
  userId: string
): Promise<DirectMessage[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      if (isTableMissing(error)) return [];
      console.error("Error fetching DMs:", error);
      return [];
    }

    return ((data ?? []) as DirectMessage[]).filter(
      (msg) => msg.sender_id === userId || msg.recipient_id === userId
    );
  } catch (err) {
    console.error("Failed to fetch DMs:", err);
    return [];
  }
}

/**
 * Mark all of the user's messages in a conversation as read
 */
export async function markConversationRead(
  userId: string,
  conversationId: string
): Promise<{ success: boolean }> {
  try {
    const { error } = await supabaseAdmin
      .from("direct_messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", userId)
      .eq("read", false);

    if (error) {
      if (isTableMissing(error)) return { success: true };
      console.error("Error marking conversation read:", error);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("Failed to mark conversation read:", err);
    return { success: false };
  }
}

/**
 * Users available to start a new conversation (excludes current user)
 */
export async function getUsersForDirectMessage(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, username, avatar, role")
      .neq("id", userId)
      .order("username");

    if (error) {
      console.error("Error fetching users for DM:", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("Failed to fetch users for DM:", err);
    return [];
  }
}

// ─── Community / Messages ────────────────────────────
// Fan community chat: text, emoji, GIFs, and image/meme
// uploads. Real-time delivery via Supabase Realtime with
// a polling fallback in the browser.

export interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  content: string;
  message_type: "text" | "gif" | "image" | "sticker";
  media_url: string | null;
  created_at: string;
}

export const COMMUNITY_MEDIA_BUCKET = "community-media";

/**
 * Fetch the most recent messages (newest last) for the chat
 */
export async function getRecentMessages(limit = 100): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return data as Message[];
}

/**
 * Post a new message to the community chat
 */
export async function createMessage(
  userId: string,
  username: string,
  avatar: string | null,
  content: string,
  messageType: Message["message_type"] = "text",
  mediaUrl: string | null = null
): Promise<Message | { error: string }> {
  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId,
    username,
    avatar,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert([newMessage])
    .select()
    .single();

  if (error) {
    console.error("Error creating message:", error);
    return { error: error.message || "Failed to send message" };
  }

  return data as Message;
}

/**
 * Upload an image/meme to the private community-media bucket
 * and return its storage path (displayed via signed URL)
 */
export async function uploadCommunityImage(
  userId: string,
  file: File
): Promise<{ path: string | null; error?: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("Error uploading community image:", error);
    return { path: null, error: error.message || "Failed to upload image" };
  }

  return { path };
}

/**
 * Create a short-lived signed URL for an uploaded community image
 */
export async function getCommunityImageUrl(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Error creating image signed URL:", error);
    return null;
  }

  return data?.signedUrl ?? null;
}
