"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Play,
  X,
  Upload,
  Link2,
  Trash2,
  Loader2,
  FileText,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { cn } from "@/lib/utils";
import type { VideoItem } from "@/lib/db";

function formatTime(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Videos topic page section: an artist-editable library of video uploads and
 * embedded links (YouTube/Vimeo). Thumbnails are shown as a uniform grid of
 * 16:9 tiles; clicking a tile opens a lightbox player.
 */
export function VideosSection() {
  const { user } = useAuth();
  const isArtist = user?.role === "artist";

  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VideoItem | null>(null);

  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resetForm = () => {
    setTitle("");
    setCaption("");
    setFile(null);
    setThumbnail(null);
    setLink("");
    setThumbnailUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "upload" && !file) {
      setError("Choose a video file to upload.");
      return;
    }
    if (mode === "link" && !link.trim()) {
      setError("Paste a YouTube or Vimeo link.");
      return;
    }

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("source", mode);
    formData.append("title", title);
    formData.append("caption", caption);
    if (mode === "upload") {
      if (file) formData.append("file", file);
      if (thumbnail) formData.append("thumbnail", thumbnail);
    } else {
      formData.append("link", link);
      formData.append("thumbnailUrl", thumbnailUrl);
    }

    try {
      const res = await uploadWithProgress("/api/videos", formData, setProgress);
      if (!res.ok) {
        setError(uploadErrorOf(res, "Failed to add video"));
        return;
      }
      const data = res.data as { item?: VideoItem } | null;
      if (data?.item) setItems((prev) => [data.item!, ...prev]);
      resetForm();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: VideoItem) => {
    if (!window.confirm(`Delete "${item.title || "this video"}"?`)) return;
    try {
      const res = await fetch(`/api/videos/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete video");
        return;
      }
      setItems((prev) => prev.filter((v) => v.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch {
      setError("Failed to delete video");
    }
  };

  return (
    <section className="mt-4 px-4">
      {/* Heading */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.22em] text-secondary">Videos</p>
        <h2 className="text-xl font-bold">The visuals</h2>
        <p className="mt-1 text-sm text-secondary">
          Music videos, sessions and short films — every tile is a watchable 16:9 thumb.
        </p>
      </div>

      {/* Artist editor */}
      {isArtist && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-border bg-zinc-900/50 p-4"
        >
          <div className="mb-3 flex items-center gap-1 rounded-xl bg-black/40 p-1">
            {(["upload", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition",
                  mode === m
                    ? "bg-primary text-white"
                    : "text-secondary hover:text-white"
                )}
              >
                {m === "upload" ? (
                  <Upload className="h-4 w-4" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {m === "upload" ? "Upload file" : "Embed link"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              required
              disabled={uploading}
              className="w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
            />
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption / description (optional)"
              disabled={uploading}
              className="w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
            />
          </div>

          {mode === "upload" ? (
            <>
              <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-zinc-950/50 px-4 py-3 transition hover:border-primary/40">
                <span className="flex min-w-0 items-center gap-2 text-sm text-secondary">
                  <Clapperboard className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {file ? file.name : "Choose a video file"}
                  </span>
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
              <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-zinc-950/50 px-4 py-3 transition hover:border-primary/40">
                <span className="flex min-w-0 items-center gap-2 text-sm text-secondary">
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {thumbnail ? thumbnail.name : "Optional thumbnail image"}
                  </span>
                </span>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </>
          ) : (
            <>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="YouTube / Vimeo link"
                required
                disabled={uploading}
                className="mt-3 w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
              />
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Optional thumbnail URL (auto for YouTube)"
                disabled={uploading}
                className="mt-2 w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
              />
            </>
          )}

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {mode === "upload" ? (
              <Upload className="h-4 w-4" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {uploading ? "Saving..." : mode === "upload" ? "Upload video" : "Add video"}
          </button>

          {uploading && (
            <UploadProgress percent={progress} label="Uploading video…" className="mt-4" />
          )}
        </form>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="flex justify-center py-12 text-secondary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-zinc-900/40 p-10 text-center">
          <Clapperboard className="mx-auto mb-3 h-8 w-8 text-secondary" />
          <p className="text-sm text-secondary">
            Nothing here yet{isArtist ? " — upload or embed the first video" : ""}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="block w-full text-left"
                aria-label={`Play ${item.title || "video"}`}
              >
                {/* Uniform 16:9 thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title || "Video thumbnail"}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : item.source === "upload" && item.media_url ? (
                    <video
                      src={item.media_url}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                      <Clapperboard className="h-10 w-10 text-secondary" />
                    </div>
                  )}

                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition group-hover:scale-110">
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </span>
                  </span>
                </div>

                <div className="p-4">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  {item.caption && (
                    <p className="mt-1 line-clamp-2 text-sm text-secondary">
                      {item.caption}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-secondary">
                    {formatTime(item.created_at)}
                  </p>
                </div>
              </button>

              {isArtist && (
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  aria-label="Delete video"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
              {selected.source === "link" && selected.embed_url ? (
                <iframe
                  src={selected.embed_url}
                  title={selected.title || "Video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : selected.media_url ? (
                <video
                  src={selected.media_url}
                  controls
                  autoPlay
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-secondary">
                  This video is temporarily unavailable.
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-lg font-bold">{selected.title}</p>
              {selected.caption && (
                <p className="mt-1 text-sm text-secondary">{selected.caption}</p>
              )}
              {isArtist && (
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete video
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}