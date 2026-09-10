"use client";

import { useState } from "react";
import { Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function NewsletterForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setSending(true);

    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        const summary =
          data.recipients === 0
            ? "No subscribers yet — the newsletter wasn't sent."
            : `Delivered to ${data.sent} of ${data.recipients} subscribers${
                data.failed ? ` · ${data.failed} failed` : ""
              }.`;
        setResult({ ok: true, text: summary });
        setSubject("");
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
    <section className="rounded-2xl border border-border bg-zinc-900 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Send className="h-5 w-5 text-primary" /> Send newsletter
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's new…"
            required
            disabled={sending}
            className="w-full rounded-lg border border-border bg-black/40 px-4 py-3 text-white placeholder-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write to your subscribers…"
            required
            rows={5}
            disabled={sending}
            className="w-full rounded-lg border border-border bg-black/40 px-4 py-3 text-white placeholder-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Sending…
            </>
          ) : (
            "Send to all subscribers"
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
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{result.text}</span>
        </div>
      )}
    </section>
  );
}