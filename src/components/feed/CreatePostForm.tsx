"use client";

import React, { useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { resolveAvatarUrl } from "@/lib/avatar-url";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB — must match the API

interface CreatePostFormProps {
  onPostCreated?: () => void;
}

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [photoMode, setPhotoMode] = useState<"upload" | "link">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Basic URL sanity check for the optional image attachment
  const isValidImageUrl = (url: string) => {
    if (!url.trim()) return true; // empty is fine (no image)
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const clearImage = () => {
    setImageUrl("");
    setPhotoMode("upload");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be under 10MB");
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await uploadWithProgress(
        "/api/posts/upload-image",
        formData,
        setUploadProgress
      );

      if (!res.ok) {
        setError(uploadErrorOf(res, "Failed to upload image"));
        return;
      }

      setImageUrl(res.data?.publicUrl as string);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Post image upload error:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageUrl.trim()) return;
    if (!isValidImageUrl(imageUrl)) {
      setError("Image must be a valid http(s) URL");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          image: imageUrl.trim() || null,
        }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create post");
        return;
      }

      setContent("");
      clearImage();
      onPostCreated?.();
      // Refresh the page to show the new post
      window.location.reload();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Post creation error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== "artist") return null;

  return (
    <div className="border-b border-border p-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden">
          <img
            src={resolveAvatarUrl(user.avatar)}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's going on, fans?"
              className="w-full resize-none border-0 bg-transparent text-white placeholder-secondary focus:outline-none focus:ring-0 text-[15px] leading-normal min-h-[60px]"
              disabled={isSubmitting}
              rows={3}
            />
            {error && (
              <p className="mt-2 text-xs text-red-500">{error}</p>
            )}
            {showImageInput && (
              <div className="mt-3">
                {imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-border">
                    <img
                      src={imageUrl}
                      alt="Post image preview"
                      className="max-h-64 w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black"
                    >
                      Remove
                    </button>
                  </div>
                ) : photoMode === "upload" ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-black/40 px-3 py-6 text-sm text-secondary transition hover:border-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4" />
                      Choose an image to upload
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={handleFileUpload}
                    />
                    {isUploading && (
                      <UploadProgress
                        percent={uploadProgress}
                        label="Uploading image…"
                        className="mt-4"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setPhotoMode("link")}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-primary"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Paste an image link instead
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste an image URL (https://…)"
                      className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm text-white placeholder-secondary focus:border-primary focus:outline-none"
                      disabled={isSubmitting}
                    />
                    {imageUrl.trim() !== "" && !isValidImageUrl(imageUrl) && (
                      <p className="mt-1 text-xs text-red-500">
                        Must be a valid http(s) URL
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        clearImage();
                        setPhotoMode("upload");
                      }}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-secondary transition hover:text-primary"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload a file instead
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (showImageInput && imageUrl.trim() === "") {
                    setShowImageInput(false);
                  } else {
                    setShowImageInput(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium transition-colors",
                  showImageInput ? "text-primary" : "text-secondary hover:text-primary"
                )}
              >
                <ImageIcon className="w-4 h-4" />
                {showImageInput ? "Hide photo option" : "Add photo"}
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (content.trim().length === 0 && imageUrl.trim().length === 0)
                }
                className={cn(
                  "rounded-full bg-primary px-5 py-2 text-base font-bold text-white transition-opacity",
                  isSubmitting ||
                    (content.trim().length === 0 && imageUrl.trim().length === 0)
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:opacity-90"
                )}
              >
                {isSubmitting ? "Posting…" : "Post"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}