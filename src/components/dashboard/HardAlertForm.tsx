"use client";

import { useState } from "react";
import { Megaphone, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const MAX_ALERT_LENGTH = 1200;

/**
 * Artist-only composer for hard alerts. The message is sent to every device
 * that has the app installed and shows IN FULL in the push notification — no
 * opening the app required. Use sparingly for urgent updates.
 */
export function HardAlertForm() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const remaining = MAX_ALERT_LENGTH - message.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const res = await fetch("/api/alerts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        const summary =
          data.devices === 0
            ? "No devices have the app installed with notifications on — nothing was sent."
            : `Alert pushed to ${data.sent} of ${data.devices} devices${
                data.failed ? ` · ${data.failed} failed` : ""
              }.`;
        setResult({ ok: true, text: summary });
        setTitle("");
        setMessage("");
      } else {
        setResult({ ok: false, text: data.error || "Failed to send" });
      }
    } catch {
      setResult({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-500/30 bg-zinc-900 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Megaphone className="h-5 w-5 text-red-400" /> Send hard alert
      </h2>
      <p className="mb-4 flex items-start gap-2 text-sm text-secondary">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        Fans see the entire message below on their phones, no opening the app.
        Use for urgent updates only.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New track drops tonight!"
            maxLength={120}
            required
            disabled={sending}
            className="w-full rounded-lg border border-border bg-black/40 px-4 py-3 text-white placeholder-secondary focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400/50"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Message</label>
            <span
              className={`text-xs ${
                remaining < 100 ? "text-amber-400" : "text-secondary"
              }`}
            >
              {remaining} left
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write the full update — it appears in full on every phone…"
            required
            rows={5}
            maxLength={MAX_ALERT_LENGTH}
            disabled={sending}
            className="w-full rounded-lg border border-border bg-black/40 px-4 py-3 text-white placeholder-secondary focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400/50 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 py-3 font-bold text-white transition-opacity hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : (
            "Alert every device"
          )}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{result.text}</span>
        </div>
      )}
    </section>
  );
}