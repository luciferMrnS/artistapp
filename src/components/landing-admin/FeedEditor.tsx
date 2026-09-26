"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { uploadErrorOf, uploadWithProgress } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import type { FeedProvider, MediaItem } from "@/lib/landing-feed";

/**
 * The artist's editor for the public landing page's picture + video feed.
 *
 * Posters go to the landing-media bucket through /api/landing-feed/upload, and
 * the row itself is created or updated afterwards — so an upload that is never
 * followed by a save leaves one unused object rather than a half-written item
 * the public page could render.
 *
 * `initialItems` is the feed the server read, used as the starting state and
 * never overwritten — every mutation here updates local state directly.
 *
 * `ready` is false until database/migration_landing_feed.sql has been applied;
 * saving is then refused with an explanation rather than silently doing nothing.
 */

type Draft = {
  id: string | null;
  kind: "video" | "photo";
  title: string;
  note: string;
  alt: string;
  provider: FeedProvider;
  providerId: string;
  posterUrl: string;
  posterPath: string | null;
  posterWidth: number;
  posterHeight: number;
};

const EMPTY: Draft = {
  id: null,
  kind: "video",
  title: "",
  note: "",
  alt: "",
  provider: "youtube",
  providerId: "",
  posterUrl: "",
  posterPath: null,
  posterWidth: 1280,
  posterHeight: 720,
};

function draftFromItem(item: MediaItem): Draft {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    note: item.note ?? "",
    alt: item.poster.alt,
    provider: item.kind === "video" && "vimeo" in item.source ? "vimeo" : "youtube",
    providerId:
      item.kind === "video"
        ? "youtube" in item.source
          ? item.source.youtube
          : item.source.vimeo
        : "",
    posterUrl: item.poster.src,
    posterPath: null,
    posterWidth: item.poster.width,
    posterHeight: item.poster.height,
  };
}

const inputClass =
  "w-full rounded-xl border border-border bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-primary/50";
const labelClass = "mb-1.5 block text-xs font-semibold text-secondary";

/** "YouTube · 8LXIM0GbqPQ" / "Photo" / "Official video" — the row's subtitle. */
function describeItem(item: MediaItem): string {
  const parts: string[] = [];
  if (item.kind === "video") {
    parts.push("vimeo" in item.source ? "Vimeo" : "YouTube", "vimeo" in item.source ? item.source.vimeo : item.source.youtube);
  } else {
    parts.push("Photo");
  }
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

/**
 * The pixel size for a poster preview.
 *
 * A fixed `h-* w-*` box plus `aspect-ratio` does not work: CSS ignores
 * `aspect-ratio` when both dimensions are definite, so the ratio was silently
 * dropped and `object-cover` cropped every poster to landscape - a 844x1503
 * visualizer became an unrecognisable horizontal slice. Deriving the width
 * from the height and the poster's own ratio keeps the true shape, and
 * `object-contain` on the image means nothing is ever cut.
 */
function previewSize(
  width: number,
  height: number,
  boxHeight: number,
  maxWidth: number
): { width: number; height: number } {
  const ratio =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? width / height
      : 16 / 9;
  /* The floor only guards legibility for a pathologically narrow poster - a
     844x1503 visualizer lands on 31px, which is too thin to read, so 32 is
     the smallest width worth showing. `object-contain` pads the remainder
     rather than cutting anything. */
  return {
    width: Math.round(Math.min(maxWidth, Math.max(32, boxHeight * ratio))),
    height: boxHeight,
  };
}

export function FeedEditor({
  initialItems,
  ready,
}: {
  initialItems: MediaItem[];
  ready: boolean;
}) {
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingThumb, setFetchingThumb] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setDraft(EMPTY);
    setEditing(false);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /* ------------------------------------------------------------- uploading */

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (draft.id) formData.append("id", draft.id);

      const res = await uploadWithProgress(
        "/api/landing-feed/upload",
        formData,
        setProgress
      );
      if (!res.ok) {
        setError(uploadErrorOf(res, "Upload failed"));
        return;
      }

      const data = res.data ?? {};
      setDraft((current) => ({
        ...current,
        posterUrl: String(data.publicUrl ?? ""),
        posterPath: typeof data.storagePath === "string" ? data.storagePath : null,
        posterWidth: Number(data.width ?? current.posterWidth),
        posterHeight: Number(data.height ?? current.posterHeight),
        // Only prefill alt text while adding; never overwrite wording the
        // artist has already written.
        alt: current.alt || file.name.replace(/\.[^.]+$/, ""),
      }));
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Pull the video's own thumbnail so the artist doesn't have to. */
  async function fetchThumbnail() {
    if (draft.provider !== "youtube" || !draft.providerId.trim()) return;
    setFetchingThumb(true);
    setError(null);
    try {
      const res = await fetch("/api/landing-feed/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: draft.provider,
          providerId: draft.providerId.trim(),
          id: draft.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not fetch it");
        return;
      }
      setDraft((current) => ({
        ...current,
        posterUrl: String(data.publicUrl ?? ""),
        posterPath: typeof data.storagePath === "string" ? data.storagePath : null,
        posterWidth: Number(data.width ?? current.posterWidth),
        posterHeight: Number(data.height ?? current.posterHeight),
      }));
    } catch {
      setError("Could not fetch the thumbnail");
    } finally {
      setFetchingThumb(false);
    }
  }

  /* --------------------------------------------------------------- saving */

  async function save() {
    setError(null);
    setNotice(null);

    if (!draft.title.trim()) return setError("Title is required");
    if (!draft.alt.trim()) return setError("Alt text is required");
    if (!draft.posterUrl) return setError("A poster image is required");
    if (draft.kind === "video" && !draft.providerId.trim()) {
      return setError("A video id is required");
    }

    const body = {
      kind: draft.kind,
      title: draft.title.trim(),
      note: draft.note.trim() || null,
      alt: draft.alt.trim(),
      provider: draft.kind === "video" ? draft.provider : null,
      providerId: draft.kind === "video" ? draft.providerId.trim() : null,
      posterUrl: draft.posterUrl,
      posterPath: draft.posterPath,
      posterWidth: draft.posterWidth,
      posterHeight: draft.posterHeight,
    };

    setBusy(true);
    try {
      const res = await fetch(
        draft.id ? `/api/landing-feed/${draft.id}` : "/api/landing-feed",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      const saved = data.item as MediaItem | undefined;
      if (saved) {
        setItems((current) =>
          draft.id
            ? current.map((item) => (item.id === draft.id ? saved : item))
            : [...current, saved]
        );
      }
      setNotice(draft.id ? "Saved." : "Added to the feed.");
      reset();
    } catch {
      setError("Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/landing-feed/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not delete");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setNotice("Removed from the feed.");
      setConfirmingDelete(null);
    } catch {
      setError("Could not delete");
    } finally {
      setBusy(false);
    }
  }

  /** Move a row and persist the whole order — positions are a sequence, so
   *  there is no single-row "move" to send. */
  async function move(id: string, direction: -1 | 1) {
    setError(null);
    setNotice(null);

    const from = items.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;

    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    setItems(next);

    const res = await fetch("/api/landing-feed/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((item) => item.id) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItems(items);
      setError(typeof data.error === "string" ? data.error : "Could not save the order");
    }
  }

  const saving = busy || uploading || fetchingThumb;

  return (
    <div className="space-y-6">
      {!ready && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-amber-300">The feed table does not exist yet</p>
          <p className="mt-1 text-secondary">
            The landing page is showing the built-in fallback feed. Run{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">
              database/migration_landing_feed.sql
            </code>{" "}
            in the Supabase SQL editor, then reload this page. Changes cannot be saved until
            then.
          </p>
        </div>
      )}

      {(error || notice) && (
        <div
          role="status"
          className={`rounded-2xl border p-3 text-sm ${
            error
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-primary/40 bg-primary/10 text-primary"
          }`}
        >
          {error ?? notice}
        </div>
      )}

      {/* ------------------------------------------------------------ form */}
      <section className="rounded-2xl border border-border bg-zinc-900/50 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {editing ? "Edit item" : "Add to the feed"}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-secondary transition hover:text-white"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className={labelClass}>Type</span>
            <div className="flex gap-2">
              {(["video", "photo"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => set("kind", option)}
                  aria-pressed={draft.kind === option}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    draft.kind === option
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-secondary hover:text-white"
                  }`}
                >
                  {option === "video" ? "Video" : "Photo"}
                </button>
              ))}
            </div>
          </div>

          {draft.kind === "video" && (
            <div>
              <span className={labelClass}>Player</span>
              <div className="flex gap-2">
                {(["youtube", "vimeo"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => set("provider", option)}
                    aria-pressed={draft.provider === option}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize transition ${
                      draft.provider === option
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-secondary hover:text-white"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {draft.kind === "video" && (
          <div className="mt-4">
            <label className={labelClass} htmlFor="lf-provider-id">
              Video id
            </label>
            <div className="flex gap-2">
              <input
                id="lf-provider-id"
                type="text"
                value={draft.providerId}
                onChange={(e) => set("providerId", e.target.value)}
                placeholder={draft.provider === "youtube" ? "e.g. 8LXIM0GbqPQ" : "e.g. 1032445716"}
                className={inputClass}
              />
              {draft.provider === "youtube" && (
                <button
                  type="button"
                  onClick={fetchThumbnail}
                  disabled={!draft.providerId.trim() || fetchingThumb}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:border-primary/50 disabled:opacity-40"
                >
                  {fetchingThumb ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  Use YouTube poster
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-secondary">
              The bit after <code className="text-[0.7rem]">youtube.com/watch?v=</code> or{" "}
              <code className="text-[0.7rem]">vimeo.com/</code>.
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="lf-title">
              Title
            </label>
            <input
              id="lf-title"
              type="text"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Animal"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="lf-note">
              Note <span className="font-normal">(optional)</span>
            </label>
            <input
              id="lf-note"
              type="text"
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="e.g. Official video"
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass} htmlFor="lf-alt">
            Alt text
          </label>
          <input
            id="lf-alt"
            type="text"
            value={draft.alt}
            onChange={(e) => set("alt", e.target.value)}
            placeholder="Describes the image for screen readers"
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <span className={labelClass}>Poster</span>
          <div className="flex flex-wrap items-center gap-4">
            {draft.posterUrl ? (
              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-zinc-950"
                style={previewSize(draft.posterWidth, draft.posterHeight, 96, 200)}
              >
                <Image
                  src={draft.posterUrl}
                  alt=""
                  fill
                  sizes="200px"
                  className="object-contain"
                />
              </div>
            ) : (
              <div
                className="flex shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-xs text-secondary"
                style={{ width: 200, height: 96 }}
              >
                No poster yet
              </div>
            )}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:border-primary/50">
              <Upload className="h-4 w-4" />
              {draft.posterUrl ? "Replace image" : "Choose image"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>
            <span className="text-xs text-secondary">JPEG or PNG, up to 8MB</span>
          </div>
          {draft.posterUrl && (
            <p className="mt-2 text-xs text-secondary">
              {draft.posterWidth} × {draft.posterHeight}
            </p>
          )}
        </div>

        {uploading && (
          <UploadProgress percent={progress} label="Uploading image…" className="mt-4" />
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !ready}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? "Save changes" : "Add to feed"}
          </button>
          {!ready && <span className="text-xs text-secondary">Run the migration first</span>}
        </div>
      </section>

      {/* ------------------------------------------------------------- list */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            On the landing page <span className="text-secondary">({items.length})</span>
          </h2>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm text-secondary transition hover:text-white"
          >
            View page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-zinc-900/40 p-10 text-center text-sm text-secondary">
            The feed is empty — the landing page will show nothing. Add an item above.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-zinc-900 p-3"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => void move(item.id, -1)}
                    disabled={index === 0 || busy}
                    aria-label={`Move ${item.title} up`}
                    className="rounded p-1 text-secondary transition hover:text-white disabled:opacity-25"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(item.id, 1)}
                    disabled={index === items.length - 1 || busy}
                    aria-label={`Move ${item.title} down`}
                    className="rounded p-1 text-secondary transition hover:text-white disabled:opacity-25"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className="shrink-0 overflow-hidden rounded-lg border border-border bg-zinc-950"
                  style={previewSize(item.poster.width, item.poster.height, 56, 120)}
                >
                  <Image
                    src={item.poster.src}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-contain"
                  />
                </div>

                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-secondary">{describeItem(item)}</p>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(draftFromItem(item));
                      setEditing(true);
                      setError(null);
                      setNotice(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={busy}
                    aria-label={`Edit ${item.title}`}
                    className="rounded-lg p-2 text-secondary transition hover:bg-zinc-800 hover:text-white disabled:opacity-40"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {confirmingDelete === item.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void remove(item.id)}
                        disabled={busy}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        className="rounded-lg px-2 py-1.5 text-xs text-secondary transition hover:text-white"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(item.id)}
                      disabled={busy}
                      aria-label={`Remove ${item.title}`}
                      className="rounded-lg p-2 text-secondary transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
