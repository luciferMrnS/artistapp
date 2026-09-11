"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Image as ImageIcon, Loader2, MessageCircle, Reply, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { Lightbox } from "@/components/ui/Lightbox";
import { markCreedRead } from "@/lib/creed-unread";
import { UserDmLink } from "@/components/dm/UserDmLink";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { useDismissOnClickOutside } from "@/hooks/useDismissOnClickOutside";

interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  content: string;
  message_type: "text" | "gif" | "image" | "sticker";
  media_url: string | null;
  reply_to_id?: string | null;
  reactions?: MessageReaction[];
  created_at: string;
}

const QUICK_REACTS = [
  "\u2764\uFE0F",
  "\u{1F602}",
  "\u{1F44D}",
  "\u{1F525}",
  "\u{1F62D}",
  "\u{1F44F}",
  "\u{1F929}",
  "\u{1F60D}",
];

const POLL_INTERVAL = 3000;
const SWIPE_THRESHOLD = 70; // px before a horizontal swipe triggers an action

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Fire `onLongPress` when a pointer is held still for `ms`. */
function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      clear();
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(onLongPress, ms);
    },
    [clear, ms, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!timer.current || !start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 12) {
        clear();
      }
    },
    [clear]
  );

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear };
}

interface MessageRowProps {
  msg: Message;
  isMine: boolean;
  repliedTo: Message | null;
  disabled: boolean;
  toggleReaction: (messageId: string, emoji: string) => void;
  setReplyTo: (m: Message | null) => void;
  setReactFor: (m: Message | null) => void;
  setPreview: (url: string) => void;
}

/**
 * A single message bubble with swipe-to-reply (left), swipe-to-react (right)
 * and long-press-to-react gestures.
 */
function MessageRow({
  msg,
  isMine,
  repliedTo,
  disabled,
  toggleReaction,
  setReplyTo,
  setReactFor,
  setPreview,
}: MessageRowProps) {
  const [dragDir, setDragDir] = useState<"reply" | "react" | null>(null);
  const longPress = useLongPress(() => {
    if (!disabled) setReactFor(msg);
  });
  const reactions = msg.reactions ?? [];

  return (
    <motion.div
      className={cn(
        "relative select-none gap-3",
        isMine ? "flex flex-row-reverse" : "flex flex-row"
      )}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      whileDrag={{ zIndex: 5 }}
      onDrag={(_, info) => {
        setDragDir(info.offset.x <= -40 ? "reply" : info.offset.x >= 40 ? "react" : null);
      }}
      onDragEnd={(_, info) => {
        setDragDir(null);
        if (disabled) return;
        if (info.offset.x <= -SWIPE_THRESHOLD) {
          setReplyTo(msg);
        } else if (info.offset.x >= SWIPE_THRESHOLD) {
          setReactFor(msg);
        }
      }}
      {...longPress}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
          isMine ? "bg-primary" : "bg-gradient-to-br from-pink-500 to-purple-500"
        )}
      >
        {msg.username.slice(0, 2).toUpperCase()}
      </div>

      <div
        className={cn(
          "max-w-[70%] min-w-0 rounded-2xl px-4 py-2",
          isMine ? "bg-primary text-white" : "bg-white/10 text-white"
        )}
      >
        <p className={cn("text-[10px] font-semibold", isMine ? "text-white/80" : "text-primary")}>
          <UserDmLink userId={msg.user_id} username={msg.username} className={isMine ? "text-white/80" : "text-primary"}>
            {msg.username}
          </UserDmLink>
        </p>

        {repliedTo && (
          <div
            className={cn(
              "mt-1 rounded-lg border-l-2 px-2 py-1",
              isMine ? "border-white/40 bg-white/10" : "border-primary/40 bg-black/20"
            )}
          >
            <p className="truncate text-[10px] font-semibold text-primary">
              ↪ {repliedTo.username}
            </p>
            <p className="truncate text-xs text-secondary">
              {repliedTo.content || (repliedTo.media_url ? "[image]" : "…")}
            </p>
          </div>
        )}

        <div className="mt-0.5 text-sm">
          {msg.message_type === "gif" || msg.message_type === "image" ? (
            <button
              type="button"
              onClick={() => setPreview(msg.media_url!)}
              aria-label="Open image full screen"
              className="block cursor-zoom-in"
            >
              <img
                src={msg.media_url!}
                alt=""
                className="max-w-[250px] rounded-lg"
                loading="lazy"
              />
            </button>
          ) : (
            <span className="break-words">{msg.content}</span>
          )}
        </div>

        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => toggleReaction(msg.id, r.emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
                  r.me
                    ? "border-primary bg-primary/30 text-white"
                    : "border-white/15 bg-white/10 text-secondary hover:bg-white/20"
                )}
              >
                <span>{r.emoji}</span>
                <span className={r.me ? "text-white" : "text-secondary"}>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <p className={cn("mt-1 text-[10px]", isMine ? "text-white/60" : "text-secondary")}>
          {formatTime(msg.created_at)}
        </p>
      </div>

      {/* Drag feedback hint */}
      <AnimatePresence>
        {dragDir && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center"
          >
            <span
              className={cn(
                "rounded-full bg-black/80 px-3 py-1 text-xs font-semibold",
                dragDir === "reply" ? "text-primary" : "text-white"
              )}
            >
              {dragDir === "reply" ? "↩ Reply" : "❤️ React"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FanCommunity() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactFor, setReactFor] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiToggleRef = useRef<HTMLButtonElement>(null);

  useDismissOnClickOutside(
    showEmoji,
    () => setShowEmoji(false),
    emojiPanelRef,
    emojiToggleRef
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // While the user is pinned near the bottom, new polls keep them there;
  // once they scroll up to read older messages, polls stop stealing focus.
  const autoScrollRef = useRef(true);

  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const forceScrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    scrollToBottom();
  }, [scrollToBottom]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP error! status: ${res.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Opening the creed clears the unread badge baseline on the sidebar
    // and the server-side baseline so push totals stay accurate.
    markCreedRead();
    fetch("/api/creed/read", { method: "POST", credentials: "include" }).catch(
      () => {}
    );

    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/messages", { credentials: "include" });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `HTTP error! status: ${res.status}` }));
          throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled && data.messages) setMessages(data.messages);
      } catch (e) {
        if (!cancelled) console.error("Failed to fetch messages:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    pollingRef.current = setInterval(fetchData, POLL_INTERVAL);
    return () => { cancelled = true; if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;
    if (user?.restricted_at) {
      window.alert("You have limited access, try again later");
      return;
    }
    const content = input.trim();
    const replyId = replyTo?.id ?? null;
    setInput("");
    setShowEmoji(false);
    setIsSending(true);

    // Additional validation to ensure content is meaningful
    if (!content || content.trim() === "") {
      setIsSending(false);
      return;
    }

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, messageType: "text", replyToId: replyId }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP error! status: ${res.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      if (replyTo) setReplyTo(null);
      await fetchMessages();
      // Sending a message snaps you back to the newest message.
      forceScrollToBottom();
    } catch (e) {
      console.error("Failed to send:", e);
    }
    setIsSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;
    if (user?.restricted_at) {
      window.alert("You have limited access, try again later");
      return;
    }
    setIsUploading(true);
    setUploadError("");
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await uploadWithProgress(
        "/api/messages/upload-image",
        formData,
        setUploadProgress
      );
      if (!res.ok) {
        throw new Error(uploadErrorOf(res, `HTTP error! status: ${res.status}`));
      }
      if (res.data?.url) {
        const res2 = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "", messageType: "image", mediaUrl: res.data.url, replyToId: replyTo?.id ?? null }),
          credentials: "include"
        });
        if (!res2.ok) {
          const errorData2 = await res2.json().catch(() => ({ error: `HTTP error! status: ${res2.status}` }));
          throw new Error(errorData2.error || `HTTP error! status: ${res2.status}`);
        }
        if (replyTo) setReplyTo(null);
        await fetchMessages();
        forceScrollToBottom();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image");
      console.error("Failed to upload image:", err);
    }
    finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user || user.restricted_at) return;
      try {
        const res = await fetch(`/api/messages/${messageId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
          credentials: "include",
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Failed to react" }));
          if (errorData?.error) console.warn(errorData.error);
          return;
        }
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      } catch (e) {
        console.error("Failed to toggle reaction:", e);
      }
    },
    [user]
  );

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-secondary">Please sign in to join the fan community.</p>
      </div>
    );
  }

  const reactionsDisabled = !!user.restricted_at;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef} onScroll={handleScroll}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="mb-3 h-12 w-12 text-secondary" />
            <p className="text-secondary">No messages yet. Be the first to say something!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isMine={msg.user_id === user.id}
                repliedTo={messagesById.get(msg.reply_to_id ?? "") ?? null}
                disabled={reactionsDisabled}
                toggleReaction={toggleReaction}
                setReplyTo={setReplyTo}
                setReactFor={setReactFor}
                setPreview={setPreview}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showEmoji && (
          <motion.div
            ref={emojiPanelRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-zinc-900 p-3"
          >
            <EmojiPicker
  onPick={(emoji) => setInput((prev) => prev + emoji)}
/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji reaction sheet — triggered by swipe-right or long-press */}
      <AnimatePresence>
        {reactFor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-zinc-900 p-3"
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-secondary">
                React to @{reactFor.username}
              </span>
              <button
                onClick={() => setReactFor(null)}
                className="rounded-full p-1 text-secondary transition hover:bg-white/10"
                aria-label="Close reactions"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {QUICK_REACTS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(reactFor.id, emoji);
                    setReactFor(null);
                  }}
                  className="rounded-lg p-2 text-2xl transition hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-border bg-zinc-900 p-3">
        {uploadError && (
          <p className="mb-2 px-1 text-xs text-red-400">{uploadError}</p>
        )}

        {/* Reply-to bar */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <Reply className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-primary">
                  Replying to @{replyTo.username}
                </p>
                <p className="truncate text-xs text-secondary">
                  {replyTo.content || (replyTo.media_url ? "[image]" : "…")}
                </p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="rounded-full p-1 text-secondary transition hover:bg-white/10"
                aria-label="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {isUploading ? (
            <UploadProgress
              percent={uploadProgress}
              size={44}
              label="Uploading image…"
              className="mx-auto"
            />
          ) : (
            <>
              <button ref={emojiToggleRef} onClick={() => setShowEmoji(!showEmoji)}
                className={cn("rounded-full p-2 transition", showEmoji ? "bg-primary text-white" : "text-secondary hover:bg-white/10")}>
                <Smile className="h-5 w-5" />
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="rounded-full p-2 text-secondary transition hover:bg-white/10 disabled:opacity-50">
                <ImageIcon className="h-5 w-5" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={replyTo ? "Reply…" : "Say something..."}
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={sendMessage} disabled={!input.trim() || isSending}
                className="rounded-full bg-primary p-2 text-white transition hover:opacity-80 disabled:opacity-50">
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>
      </div>
      {preview && (
        <Lightbox src={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}