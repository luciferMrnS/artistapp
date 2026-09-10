"use client";

import { useEffect, useRef, useState } from "react";
import {
  Music2,
  Video,
  Image as ImageIcon,
  Upload,
  Loader2,
  FileText,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import type { MediaType, ThemeSlug, ThemeMediaItem } from "@/lib/db";

const THEME_COPY: Record<
  ThemeSlug,
  { heading: string; hint: string }
> = {
  "new-drop": {
    heading: "New drop media",
    hint: "First listens, cover art, teasers and previews for the latest release.",
  },
  "behind-the-scenes": {
    heading: "Behind the scenes",
    hint: "Raw clips and photos from the road, the booth and the writing room.",
  },
  studio: {
    heading: "Studio sessions",
    hint: "Takes, gear looks and audio from the room where the records get made.",
  },
};

const TYPE_META: Record<
  MediaType,
  { icon: typeof Music2; label: string }
> = {
  audio: { icon: Music2, label: "Audio" },
  video: { icon: Video, label: "Video" },
  photo: { icon: ImageIcon, label: "Photo" },
};

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

export function ThemeMediaSection({ theme }: { theme: ThemeSlug }) {
  const { user } = useAuth();
  const copy = THEME_COPY[theme];

  const [items, setItems] = useState<ThemeMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<MediaType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/theme-media?theme=${encodeURIComponent(theme)}`
        );
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
  }, [theme, version]);

  const isArtist = user?.role === "artist";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setUploadError(null);
    if (f) {
      if (f.type.startsWith("image/")) setDetectedType("photo");
      else if (f.type.startsWith("audio/")) setDetectedType("audio");
      else if (f.type.startsWith("video/")) setDetectedType("video");
      else setDetectedType(null);
    } else {
      setDetectedType(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !detectedType || uploading) return;
    setUploading(true);
    setUploadError(null);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("theme", theme);
      formData.append("mediaType", detectedType);
      formData.append("title", title);
      formData.append("caption", caption);
      formData.append("file", file);

      const res = await uploadWithProgress("/api/theme-media", formData, setProgress);

      if (!res.ok) {
        setUploadError(uploadErrorOf(res, "Upload failed"));
        return;
      }

      setTitle("");
      setCaption("");
      setFile(null);
      setDetectedType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setVersion((v) => v + 1);
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="border-t border-border px-4 pt-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.22em] text-secondary">
          {theme.replace(/-/g, " ")}
        </p>
        <h2 className="text-xl font-bold">{copy.heading}</h2>
        <p className="mt-1 text-sm text-secondary">{copy.hint}</p>
      </div>

      {/* Artist upload */}
      {isArtist && (
        <div className="mb-6 rounded-2xl border border-border bg-zinc-900/50 p-4">
          <p className="mb-3 text-sm font-semibold">
            Upload audio, video or photos
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. 'Drop teaser')"
              className="w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
            />
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption / description (optional)"
              className="w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
            />
          </div>

          <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-zinc-950/50 px-4 py-3 transition hover:border-primary/40">
            <span className="flex min-w-0 items-center gap-2 text-sm text-secondary">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {file ? file.name : "Choose an audio, video or photo file"}
              </span>
            </span>
            {detectedType && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                {(() => {
                  const Icon = TYPE_META[detectedType].icon;
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {TYPE_META[detectedType].label}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*,image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {uploadError && (
            <p className="mt-2 text-xs text-red-500">{uploadError}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !detectedType || uploading}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>

          {uploading && (
            <UploadProgress percent={progress} label="Uploading media…" className="mt-4" />
          )}
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="flex justify-center py-12 text-secondary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-secondary">
            Nothing here yet{isArtist ? " — upload the first piece" : ""}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const meta = TYPE_META[item.media_type];
            const Icon = meta.icon;
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border bg-zinc-900"
              >
                <div className="flex w-full items-center justify-center bg-zinc-950">
                  {item.media_type === "photo" ? (
                    <img
                      src={item.media_url}
                      alt={item.title || "Media"}
                      className="aspect-video w-full object-cover"
                    />
                  ) : item.media_type === "video" ? (
                    <video
                      src={item.media_url}
                      controls
                      preload="metadata"
                      className="aspect-video w-full"
                    />
                  ) : (
                    <div className="w-full bg-gradient-to-br from-zinc-900 to-zinc-800 p-6">
                      <audio src={item.media_url} controls className="w-full" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </span>
                    <span className="text-xs text-secondary">
                      {formatTime(item.created_at)}
                    </span>
                  </div>
                  {item.title && (
                    <p className="mt-2 text-sm font-semibold">{item.title}</p>
                  )}
                  {item.caption && (
                    <p className="mt-1 text-sm text-secondary">{item.caption}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}