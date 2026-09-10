"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import {
  Camera,
  Upload,
  AlertCircle,
  Lock,
  Loader2,
  BadgeCheck,
} from "lucide-react";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — must match the API

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function ProfilePageContent() {
  const { user, setUser } = useAuth();

  // ─── Profile form state ───────────────────────────
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Password form state ──────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (avatar.trim() !== "" && !isValidImageUrl(avatar)) {
      setProfileError("Profile picture must be a valid http(s) URL");
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          avatar: avatar.trim(),
        }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        setProfileError(data.error || "Failed to update profile");
        return;
      }

      setUser(data.user);
      setProfileMessage("Profile updated successfully.");
    } catch {
      setProfileError("Something went wrong. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || avatarUploading) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Please choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setProfileError("Image must be under 10MB");
      return;
    }

    setAvatarUploading(true);
    setProfileError("");
    setAvatarProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadWithProgress(
        "/api/profile/upload-avatar",
        formData,
        setAvatarProgress
      );

      if (!res.ok) {
        setProfileError(uploadErrorOf(res, "Failed to upload image"));
        return;
      }

      setAvatar(res.data?.publicUrl as string);
    } catch {
      setProfileError("Something went wrong. Please try again.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Failed to change password");
        return;
      }

      if (data.requiresEmailConfirmation) {
        setPasswordMessage(
          data.message ||
            "A confirmation link has been sent to your email. Click it to finish changing your password."
        );
      } else {
        setPasswordMessage("Password changed successfully.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Something went wrong. Please try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="border-b border-border bg-black/80">
            <div className="mx-auto flex max-w-[680px] items-center justify-between px-4 py-4">
              <h1 className="text-xl font-bold">Edit Profile</h1>
              {user?.role === "artist" ? (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                  Artist
                </span>
              ) : (
                <span className="text-xs bg-zinc-800 text-secondary px-2 py-0.5 rounded-full font-medium">
                  Fan
                </span>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[680px] px-4 py-6 pb-16">
            {/* ─── Profile details ─── */}
            <section className="rounded-2xl border border-border bg-zinc-900/40 p-6">
              <h2 className="text-lg font-semibold">Profile details</h2>
              <p className="mt-1 text-xs text-secondary">
                Your display name appears on posts, comments and follows.
              </p>

              <form onSubmit={handleProfileSave} className="mt-6 space-y-5">
                {/* Avatar preview + upload */}
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="group relative shrink-0"
                    aria-label="Upload a profile picture"
                  >
                    <div className="h-20 w-20 overflow-hidden rounded-full border border-border bg-zinc-800">
                      {avatarUploading ? (
                        <div className="flex h-full w-full items-center justify-center bg-black/70">
                          <UploadProgress percent={avatarProgress} size={44} />
                        </div>
                      ) : avatar.trim() !== "" && isValidImageUrl(avatar) ? (
                        <img
                          src={resolveAvatarUrl(avatar)}
                          alt="Profile picture preview"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-black text-secondary">
                          {username.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary ring-2 ring-black transition group-hover:bg-primary/80">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={avatarUploading}
                    onChange={handleAvatarUpload}
                  />

                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">
                      Profile picture
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-zinc-900 px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {avatarUploading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" />
                            Upload photo
                          </>
                        )}
                      </button>
                      {avatar && (
                        <button
                          type="button"
                          onClick={() => setAvatar("")}
                          className="text-xs font-medium text-secondary transition hover:text-red-400"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-secondary">
                      Click the picture or “Upload photo” to choose a file, or
                      reset to a default avatar.
                    </p>
                  </div>
                </div>

                {/* Username / artist name */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {user?.role === "artist" ? "Artist name" : "Username"}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={30}
                    className="w-full rounded-lg border border-border bg-zinc-900 px-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email ?? ""}
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-border bg-zinc-900/60 px-4 py-3 text-secondary"
                  />
                  <p className="mt-1 text-xs text-secondary">
                    Your email can&apos;t be changed.
                  </p>
                </div>

                {profileMessage && (
                  <p className="flex items-center gap-2 text-sm text-emerald-400">
                    <BadgeCheck className="h-4 w-4" /> {profileMessage}
                  </p>
                )}
                {profileError && (
                  <p className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" /> {profileError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving || !username.trim()}
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save changes
                </button>
              </form>
            </section>

            {/* ─── Change password ─── */}
            <section className="mt-6 rounded-2xl border border-border bg-zinc-900/40 p-6">
              <h2 className="text-lg font-semibold">Change password</h2>
              <p className="mt-1 text-xs text-secondary">
                You&apos;ll need your current password to set a new one.
              </p>

              <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Current password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-border bg-zinc-900 pl-12 pr-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-lg border border-border bg-zinc-900 pl-12 pr-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-border bg-zinc-900 pl-12 pr-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-2 text-xs text-red-500">
                      Passwords don&apos;t match
                    </p>
                  )}
                </div>

                {passwordMessage && (
                  <p className="flex items-center gap-2 text-sm text-emerald-400">
                    <BadgeCheck className="h-4 w-4" /> {passwordMessage}
                  </p>
                )}
                {passwordError && (
                  <p className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="h-4 w-4" /> {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    passwordSaving ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {passwordSaving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Change password
                </button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}

