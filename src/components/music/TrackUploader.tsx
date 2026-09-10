"use client";

import React, { useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB — must match the API
const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB — must match the API

/**
 * Artist-only upload form for new tracks.
 * Files go to the private "tracks" storage bucket via the API;
 * fans can only stream them through short-lived signed URLs.
 */
export function TrackUploader() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  if (user?.role !== "artist") return null;

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c = e.target.files?.[0] ?? null;
    setCover(c);
    setError("");
    if (c) {
      const reader = new FileReader();
      reader.onload = () => setCoverPreview(String(reader.result));
      reader.readAsDataURL(c);
    } else {
      setCoverPreview(null);
    }
  };

  const clearCover = () => {
    setCover(null);
    setCoverPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setError("A title and an audio file are both required.");
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError("Audio file is too large (max 50 MB).");
      return;
    }
    if (cover && cover.size > MAX_COVER_BYTES) {
      setError("Album cover is too large (max 5 MB).");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("file", file);
      if (cover) formData.append("cover", cover);

      const res = await uploadWithProgress(
        "/api/tracks",
        formData,
        setProgress
      );

      if (!res.ok) {
        setError(uploadErrorOf(res, "Failed to upload track"));
        return;
      }

      // Refresh to show the new track
      window.location.reload();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Track upload error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-xl border border-dashed border-border bg-black/30 p-4"
    >
      <p className="mb-3 text-sm font-semibold">Upload a track</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Track title"
          maxLength={120}
          className={cn(
            "flex-1 rounded-lg border border-border bg-black/40 px-3 py-2 text-sm",
            "outline-none transition placeholder:text-zinc-500 focus:border-primary/50"
          )}
        />
        <label
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border",
            "bg-black/40 px-3 py-2 text-sm text-secondary transition hover:text-white"
          )}
        >
          <Upload className="h-4 w-4" />
          <span className="max-w-[160px] truncate">
            {file ? file.name : "Choose audio file"}
          </span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black",
            "transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {isSubmitting ? "Uploading..." : "Upload"}
        </button>
      </div>

      {/* Clockwise upload progress */}
      {isSubmitting && (
        <UploadProgress percent={progress} label="Uploading audio…" className="mt-4" />
      )}

      {/* Optional album cover */}
      <div className="mt-3 flex items-center gap-3">
        {coverPreview ? (
          <div className="relative h-14 w-14 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverPreview}
              alt="Album cover preview"
              className="h-14 w-14 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={clearCover}
              aria-label="Remove album cover"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border",
            "bg-black/40 px-3 py-2 text-sm text-secondary transition hover:text-white"
          )}
        >
          <ImagePlus className="h-4 w-4" />
          <span className="max-w-[200px] truncate">
            {cover ? cover.name : "Album cover (optional)"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}