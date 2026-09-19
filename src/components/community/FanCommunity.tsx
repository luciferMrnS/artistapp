"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, Send, Smile, Image as ImageIcon, Loader2, MessageCircle, Reply, X, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { KebabMenu } from "@/components/ui/KebabMenu";
import { Lightbox } from "@/components/ui/Lightbox";
import { markCreedRead } from "@/lib/creed-unread";
import { UserDmLink } from "@/components/dm/UserDmLink";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { useDismissOnClickOutside } from "@/hooks/useDismissOnClickOutside";
import { useJumpToBottom } from "@/hooks/useJumpToBottom";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { JumpToLatest } from "@/components/ui/JumpToLatest";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import {
  AnnouncementBanner,
  type AnnouncementData,
} from "@/components/community/AnnouncementBanner";

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
  edited_at?: string | null;
  deleted_at?: string | null;
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
const MAX_MENTION_SUGGESTIONS = 8;

const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface MentionUser {
  id: string;
  username: string;
  avatar: string | null;
  role: string;
}

interface ActiveMention {
  start: number;
  end: number;
  query: string;
}

/**
 * Detect an in-progress mention token right before the caret:
 * an `@` at the start of a word (or after whitespace) with no
 * whitespace between it and the caret — e.g. "hey @kd" while typing.
 */
function detectMention(
  value: string,
  caret: number
): ActiveMention | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|\s)@([^\s@]*)$/);
  if (!match) return null;
  const start = caret - match[2].length - 1; // index of the `@`
  return { start, end: caret, query: match[2] };
}

/**
 * Split a message body into text and `@username` tokens so mentions can be
 * highlighted. Any @-token is styled — typed names work too even if they
 * don't match a real account.
 */
function renderMentionContent(content: string) {
  const parts = content.split(/(@[\w.]+)/g);
  return parts.map((part, i) =>
    /^@[\w.]+$/.test(part) ? (
      <span key={i} className="font-semibold text-red-500">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

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
  replyToId: string | null;
  highlighted: boolean;
  disabled: boolean;
  toggleReaction: (messageId: string, emoji: string) => void;
  setReplyTo: (m: Message | null) => void;
  setReactFor: (m: Message | null) => void;
  setPreview: (url: string) => void;
  onJumpToReply: (messageId: string) => void;
  onEdit: (msg: Message) => void;
  onDeleteMessage: (msg: Message) => Promise<boolean>;
}

/**
 * A single message bubble with swipe-to-reply (left), swipe-to-react (right)
 * and long-press-to-react gestures. Own messages get a kebab menu with
 * edit/delete actions; deleted messages collapse to a placeholder.
 */
function MessageRow({
  msg,
  isMine,
  repliedTo,
  replyToId,
  highlighted,
  disabled,
  toggleReaction,
  setReplyTo,
  setReactFor,
  setPreview,
  onJumpToReply,
  onEdit,
  onDeleteMessage,
}: MessageRowProps) {
  const [dragDir, setDragDir] = useState<"reply" | "react" | null>(null);
  const longPress = useLongPress(() => {
    if (!disabled) setReactFor(msg);
  });
  const reactions = msg.reactions ?? [];
  const deleted = !!msg.deleted_at;
  const editable = isMine && !deleted && msg.message_type === "text";

  return (
    <motion.div
      data-message-id={msg.id}
      className={cn(
        "relative select-none gap-3 rounded-xl transition-shadow",
        highlighted && "ring-2 ring-primary shadow-[0_0_24px_rgba(29,155,240,0.35)]",
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
      {msg.avatar ? (
        <img
          src={resolveAvatarUrl(msg.avatar)}
          alt={msg.username}
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            isMine ? "bg-primary" : "bg-gradient-to-br from-pink-500 to-purple-500"
          )}
        >
          {msg.username.slice(0, 2).toUpperCase()}
        </div>
      )}

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

        {deleted ? (
          <p className="mt-1 text-xs italic text-white/60">Message deleted</p>
        ) : (
          <>
            {(repliedTo || replyToId) && (
              <button
                type="button"
                onClick={() => replyToId && onJumpToReply(replyToId)}
                title="Jump to the original message"
                className={cn(
                  "mt-1 block w-full cursor-pointer rounded-lg border-l-2 px-2 py-1 text-left transition hover:bg-white/15",
                  isMine ? "border-white/40 bg-white/10" : "border-primary/40 bg-black/20"
                )}
              >
                <p className="truncate text-[10px] font-semibold text-primary">
                  ↪ {repliedTo ? repliedTo.username : "Message"}
                </p>
                <p className="truncate text-xs text-secondary">
                  {repliedTo
                    ? repliedTo.deleted_at
                      ? "Message deleted"
                      : repliedTo.content || (repliedTo.media_url ? "[image]" : "…")
                    : "Load original message"}
                </p>
              </button>
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
                <span className="break-words">{renderMentionContent(msg.content)}</span>
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
          </>
        )}

        <p className={cn("mt-1 text-[10px]", isMine ? "text-white/60" : "text-secondary")}>
          {formatTime(msg.created_at)}
          {msg.edited_at && <span className="ml-1 italic opacity-70">(edited)</span>}
        </p>
      </div>

      {isMine && !deleted && !disabled && (
        <KebabMenu
          deleteLabel="Delete message"
          onDelete={() => onDeleteMessage(msg)}
          editLabel={editable ? "Edit message" : undefined}
          onEdit={editable ? () => onEdit(msg) : undefined}
        />
      )}

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
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);

  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceError, setAnnounceError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiToggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionPanelRef = useRef<HTMLDivElement>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const filtered = q
      ? mentionUsers.filter((u) => u.username.toLowerCase().includes(q))
      : mentionUsers;
    return filtered.slice(0, MAX_MENTION_SUGGESTIONS);
  }, [mention, mentionUsers]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dm/users", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.users) setMentionUsers(data.users);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useDismissOnClickOutside(
    showEmoji,
    () => setShowEmoji(false),
    emojiPanelRef,
    emojiToggleRef
  );

  useDismissOnClickOutside(
    !!mention,
    () => setMention(null),
    mentionPanelRef,
    inputRef
  );

  useEffect(() => {
    let cancelled = false;

    const fetchAnnouncement = async () => {
      try {
        const res = await fetch("/api/announcements", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const latest = (data.announcements ?? [])[0] ?? null;
        setAnnouncement(latest ? (latest as AnnouncementData) : null);
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
      }
    };

    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Scroll to the newest message exactly once when the page is first opened —
  // new incoming messages never yank the user's scroll position afterwards.
  const scrolledOnOpenRef = useRef(false);

  const {
    setContainerRef,
    containerRef,
    showButton: showJumpToLatest,
    jumpToBottom,
    rememberOpenScroll,
    refreshPosition,
  } = useJumpToBottom();

  const { highlightedId, scrollToMessage } = useScrollToMessage(containerRef);

  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );

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
    if (scrolledOnOpenRef.current || messages.length === 0) return;
    scrolledOnOpenRef.current = true;
    rememberOpenScroll();
    const id = requestAnimationFrame(jumpToBottom);
    return () => cancelAnimationFrame(id);
  }, [messages, jumpToBottom, rememberOpenScroll]);

  // Keep the "jump to latest" button in sync when the message list changes —
  // e.g. a new message arrives while the user is reading older messages.
  useEffect(() => {
    if (!messages.length) return;
    return refreshPosition();
  }, [messages, refreshPosition]);

  // When the user taps a reply preview whose original message isn't loaded
  // (outside the recent window), it is fetched and inserted above; this ref
  // holds the id until it shows up in the list, then we scroll to it.
  const pendingJumpRef = useRef<string | null>(null);

  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending || !messagesById.has(pending)) return;
    pendingJumpRef.current = null;
    const id = requestAnimationFrame(() => scrollToMessage(pending));
    return () => cancelAnimationFrame(id);
  }, [messagesById, scrollToMessage]);

  const jumpToMessage = useCallback(
    async (messageId: string) => {
      if (messagesById.has(messageId)) {
        scrollToMessage(messageId);
        return;
      }
      // Message is older than the loaded window — fetch it from the server.
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const fetched = data.message as Message | null;
        if (!fetched) return;
        pendingJumpRef.current = fetched.id;
        setMessages((prev) => {
          if (prev.some((m) => m.id === fetched.id)) return prev;
          return [...prev, fetched].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          );
        });
      } catch (e) {
        console.error("Failed to fetch referenced message:", e);
      }
    },
    [messagesById, scrollToMessage]
  );

  const selectMention = (u: MentionUser) => {
    if (!mention) return;
    const next =
      input.slice(0, mention.start) + " @" + u.username + " " + input.slice(mention.end);
    const caret = mention.start + u.username.length + 2;
    setInput(next);
    setMention(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const caret = e.target.selectionStart ?? value.length;
    setInput(value);
    setMention(detectMention(value, caret));
    setMentionIndex(0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionMatches.length) % mentionMatches.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(mentionMatches[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;
    if (user?.restricted_at) {
      window.alert("You have limited access, try again later");
      return;
    }
    setMention(null);
    const content = input.trim();
    if (!content) return;
    setShowEmoji(false);
    setIsSending(true);

    // Editing an existing message instead of sending a new one.
    if (editingMsg) {
      try {
        const res = await fetch(`/api/messages/${encodeURIComponent(editingMsg.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          credentials: "include",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.warn(data?.error || "Failed to edit message");
          return;
        }
        const updated = data?.message as Message | null;
        if (updated) {
          setMessages((prev) =>
            prev.map((m) => (m.id === editingMsg.id ? updated : m))
          );
        } else {
          await fetchMessages();
        }
        setEditingMsg(null);
        setInput("");
        jumpToBottom();
      } catch (e) {
        console.error("Failed to edit message:", e);
      } finally {
        setIsSending(false);
      }
      return;
    }

    const replyId = replyTo?.id ?? null;
    setInput("");

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
      jumpToBottom();
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
        jumpToBottom();
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

  const startEdit = (msg: Message) => {
    setEditingMsg(msg);
    setInput(msg.content);
    setReplyTo(null);
    setMention(null);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(msg.content.length, msg.content.length);
    });
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput("");
  };

  const deleteMessageRow = async (msg: Message): Promise<boolean> => {
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(msg.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.warn(data?.error ?? "Failed to delete message");
        return false;
      }
      const data = await res.json();
      const updated = data?.message as Message | null;
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }
      if (replyTo?.id === msg.id) setReplyTo(null);
      if (editingMsg?.id === msg.id) cancelEdit();
      return true;
    } catch (e) {
      console.error("Failed to delete message:", e);
      return false;
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-secondary">Please sign in to join the fan community.</p>
      </div>
    );
  }

  const isArtist = user.role === "artist";

  const visibleAnnouncement =
    announcement && announcement.id !== dismissedAnnouncementId ? announcement : null;

  const postAnnouncement = async () => {
    const content = announceText.trim();
    if (!content) return;
    setAnnounceSending(true);
    setAnnounceError("");
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setAnnounceError(data?.error ?? "Failed to post announcement");
        return;
      }
      setAnnouncement(data.announcement as AnnouncementData);
      setDismissedAnnouncementId(null);
      setAnnounceText("");
      setShowAnnounce(false);
    } catch (err) {
      setAnnounceError(err instanceof Error ? err.message : "Failed to post announcement");
    } finally {
      setAnnounceSending(false);
    }
  };

  const deleteCurrentAnnouncement = async () => {
    if (!announcement) return;
    setAnnounceSending(true);
    setAnnounceError("");
    try {
      const res = await fetch(`/api/announcements/${announcement.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setAnnounceError(data?.error ?? "Failed to delete announcement");
        return;
      }
      setAnnouncement(null);
      setDismissedAnnouncementId(null);
    } catch (err) {
      setAnnounceError(err instanceof Error ? err.message : "Failed to delete announcement");
    } finally {
      setAnnounceSending(false);
    }
  };

  const reactionsDisabled = !!user.restricted_at;

  return (
    <div className="flex h-full flex-col">
      <AnnouncementBanner
        announcement={visibleAnnouncement}
        onDismiss={() => visibleAnnouncement && setDismissedAnnouncementId(visibleAnnouncement.id)}
      />
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={setContainerRef}
          className="absolute inset-0 space-y-3 overflow-y-auto p-4"
        >
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
                  replyToId={msg.reply_to_id ?? null}
                  highlighted={highlightedId === msg.id}
                  disabled={reactionsDisabled || !!msg.deleted_at}
                  toggleReaction={toggleReaction}
                  setReplyTo={setReplyTo}
                  setReactFor={setReactFor}
                  setPreview={setPreview}
                  onJumpToReply={jumpToMessage}
                  onEdit={startEdit}
                  onDeleteMessage={deleteMessageRow}
                />
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>
        <JumpToLatest show={showJumpToLatest} onClick={jumpToBottom} />
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

      <div className="relative border-t border-border bg-zinc-900 p-3">
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

        {/* Edit-message bar — replaces reply-to bar while editing */}
        <AnimatePresence>
          {editingMsg && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <Pencil className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-primary">
                  Editing message
                </p>
                <p className="truncate text-xs text-secondary">{editingMsg.content || ""}</p>
              </div>
              <button
                onClick={cancelEdit}
                className="rounded-full p-1 text-secondary transition hover:bg-white/10"
                aria-label="Cancel editing"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mention suggestions — pops up while typing @name */}
        <AnimatePresence>
          {mention && (
            <motion.div
              ref={mentionPanelRef}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full left-3 right-3 z-30 mb-2 overflow-hidden rounded-xl border border-border bg-zinc-800 shadow-2xl"
            >
              {mentionMatches.length === 0 ? (
                <p className="px-4 py-3 text-xs text-secondary">
                  No users match “{mention.query}”
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {mentionMatches.map((u, i) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setMentionIndex(i)}
                        onClick={() => selectMention(u)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition",
                          i === mentionIndex ? "bg-white/10" : "hover:bg-white/5"
                        )}
                      >
                        {u.avatar ? (
                          <img
                            src={resolveAvatarUrl(u.avatar)}
                            alt={u.username}
                            className="h-8 w-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-[10px] font-bold text-white">
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          @{u.username}
                        </span>
                        {u.role === "artist" && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Artist
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
              {isArtist && (
                <button
                  onClick={() => {
                    setAnnounceError("");
                    setShowAnnounce(true);
                  }}
                  className="relative rounded-full p-2 text-secondary transition hover:bg-white/10 hover:text-primary"
                  title="Make an announcement"
                  aria-label="Make an announcement"
                >
                  <Megaphone className="h-5 w-5" />
                </button>
              )}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                placeholder={editingMsg ? "Edit message…" : replyTo ? "Reply…" : "Say something..."}
                className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button onClick={sendMessage} disabled={!input.trim() || isSending}
                className="rounded-full bg-primary p-2 text-white transition hover:opacity-80 disabled:opacity-50">
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : editingMsg ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              </button>
            </>
          )}
        </div>
      </div>
      {preview && (
        <Lightbox src={preview} onClose={() => setPreview(null)} />
      )}

      <AnimatePresence>
        {showAnnounce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowAnnounce(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-zinc-900 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                  <Megaphone className="h-4 w-4" /> Make an announcement
                </h3>
                <button
                  onClick={() => setShowAnnounce(false)}
                  className="rounded-full p-1 text-secondary transition hover:bg-white/10"
                  aria-label="Close announcement composer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-4 text-xs text-secondary">
                This plays as a sliding banner at the top of Creed that every fan sees.
              </p>

              <textarea
                value={announceText}
                onChange={(e) => setAnnounceText(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="e.g. New single DROPS FRIDAY ⚡ don't miss it!"
                className="w-full resize-none rounded-xl border border-border bg-white/5 p-3 text-sm text-white placeholder-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="mt-1 text-right text-xs text-secondary">
                {announceText.length}/200
              </div>

              {announceError && (
                <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {announceError}
                </p>
              )}

              {announcement && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-white/5 p-3">
                  <p className="min-w-0 flex-1 truncate text-xs text-secondary">
                    Currently showing: <span className="text-white">{announcement.content}</span>
                  </p>
                  <button
                    onClick={deleteCurrentAnnouncement}
                    disabled={announceSending}
                    className="shrink-0 rounded-lg border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}

              <button
                onClick={postAnnouncement}
                disabled={!announceText.trim() || announceSending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition hover:opacity-80 disabled:opacity-50"
              >
                {announceSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Megaphone className="h-4 w-4" />
                )}
                Post announcement
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}