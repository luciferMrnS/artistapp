"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Plus, Check, Pencil, Loader2, MessageCircle, Search, EyeOff, Smile, ArrowLeft, Reply, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { UserDmLink } from "@/components/dm/UserDmLink";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { motion, AnimatePresence } from "framer-motion";
import { useDismissOnClickOutside } from "@/hooks/useDismissOnClickOutside";
import { useJumpToBottom } from "@/hooks/useJumpToBottom";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { JumpToLatest } from "@/components/ui/JumpToLatest";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { Lightbox } from "@/components/ui/Lightbox";
import { KebabMenu } from "@/components/ui/KebabMenu";

interface MessageReaction {
  emoji: string;
  count: number;
  me: boolean;
}

interface DMChat {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  media_url: string | null;
  read: boolean;
  reply_to_id?: string | null;
  reactions?: MessageReaction[];
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

interface ConversationSummary {
  conversation_id: string;
  other_user: {
    id: string;
    username: string;
    avatar: string;
    role: "artist" | "fan";
  };
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
}

interface UserOption {
  id: string;
  username: string;
  avatar: string;
  role: "artist" | "fan";
}

const POLL_INTERVAL = 4000;
const SWIPE_THRESHOLD = 70; // px before a horizontal swipe triggers an action

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

interface DmBubbleProps {
  msg: DMChat;
  mine: boolean;
  repliedTo: DMChat | null;
  replyToId: string | null;
  repliedToLabel: string | null;
  highlighted: boolean;
  disabled: boolean;
  toggleReaction: (messageId: string, emoji: string) => void;
  setReplyTo: (m: DMChat | null) => void;
  setReactFor: (m: DMChat | null) => void;
  setPreview: (url: string) => void;
  onJumpToReply: (messageId: string) => void;
  onEdit: (msg: DMChat) => void;
  onDeleteMessage: (msg: DMChat) => Promise<boolean>;
}

/**
 * A single DM bubble with swipe-to-reply (left), swipe-to-react (right)
 * and long-press-to-react gestures — same as Creed.
 */
function DmBubble({
  msg,
  mine,
  repliedTo,
  replyToId,
  repliedToLabel,
  highlighted,
  disabled,
  toggleReaction,
  setReplyTo,
  setReactFor,
  setPreview,
  onJumpToReply,
  onEdit,
  onDeleteMessage,
}: DmBubbleProps) {
  const [dragDir, setDragDir] = useState<"reply" | "react" | null>(null);
  const longPress = useLongPress(() => {
    if (!disabled) setReactFor(msg);
  });
  const reactions = msg.reactions ?? [];
  const deleted = !!msg.deleted_at;
  const editable = mine && !deleted && !msg.media_url;

  return (
    <motion.div
      data-message-id={msg.id}
      className={cn(
        "relative select-none rounded-xl transition-shadow",
        highlighted && "ring-2 ring-primary shadow-[0_0_24px_rgba(29,155,240,0.35)]",
        mine ? "flex justify-end" : "flex justify-start"
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
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
          mine
            ? "rounded-br-md bg-primary text-white"
            : "rounded-bl-md bg-zinc-800 text-white"
        )}
      >
        {deleted ? (
          <p className="text-xs italic text-white/60">Message deleted</p>
        ) : (
          <>
            {(repliedTo || replyToId) && (
              <button
                type="button"
                onClick={() => replyToId && onJumpToReply(replyToId)}
                title="Jump to the original message"
                className={cn(
                  "mb-1 block w-full cursor-pointer rounded-lg border-l-2 px-2 py-1 text-left transition hover:bg-white/15",
                  mine ? "border-white/40 bg-white/10" : "border-primary/40 bg-black/20"
                )}
              >
                <p className="truncate text-[10px] font-semibold text-primary">
                  ↪ {repliedToLabel ?? "Message"}
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

            {msg.media_url ? (
              <button
                type="button"
                onClick={() => setPreview(msg.media_url!)}
                aria-label="Open image full screen"
                className="mb-1 block cursor-zoom-in"
              >
                <img
                  src={msg.media_url}
                  alt=""
                  className="max-h-52 rounded-lg object-cover"
                />
              </button>
            ) : null}

            <span className="whitespace-pre-wrap break-words">{msg.content}</span>

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

        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            mine ? "text-white/70" : "text-secondary"
          )}
        >
          {formatTime(msg.created_at)}
          {msg.edited_at && <span className="ml-1 italic opacity-70">(edited)</span>}
        </p>
      </div>

      {mine && !deleted && !disabled && (
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

function formatTime(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

export function DirectMessages() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const targetUserId = searchParams?.get("user") ?? null;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<{
    conversationId: string | null;
    recipient: UserOption;
  } | null>(null);
  const [messages, setMessages] = useState<DMChat[]>([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [convoError, setConvoError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DMChat | null>(null);
  const [reactFor, setReactFor] = useState<DMChat | null>(null);
  const [editingMsg, setEditingMsg] = useState<DMChat | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  const {
    setContainerRef,
    containerRef,
    showButton: showJumpToLatest,
    jumpToBottom,
    rememberOpenScroll,
    refreshPosition,
  } = useJumpToBottom();

  const { highlightedId, scrollToMessage } = useScrollToMessage(containerRef);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiToggleRef = useRef<HTMLButtonElement>(null);

  useDismissOnClickOutside(showEmoji, () => setShowEmoji(false), emojiPanelRef, emojiToggleRef);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/dm/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // best-effort
    }
  }, []);

  const markRead = useCallback(async (conversationId: string) => {
    try {
      await fetch("/api/dm/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
    } catch {
      // best-effort
    }
  }, []);

  const selectConversation = (convo: ConversationSummary) => {
    setShowNewPicker(false);
    setShowEmoji(false);
    setReplyTo(null);
    setReactFor(null);
    setActive({
      conversationId: convo.conversation_id,
      recipient: {
        id: convo.other_user.id,
        username: convo.other_user.username,
        avatar: convo.other_user.avatar,
        role: convo.other_user.role,
      },
    });
    if (convo.unread_count > 0) {
      markRead(convo.conversation_id);
      setConversations((prev) =>
        prev.map((c) =>
          c.conversation_id === convo.conversation_id ? { ...c, unread_count: 0 } : c
        )
      );
    }
  };

  // Opening the inbox clears the sidebar badge — mark everything read.
  useEffect(() => {
    fetch("/api/dm/read-all", { method: "POST" }).catch(() => {
      // best-effort — per-conversation read marking covers the rest
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dm/conversations");
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        if (cancelled) return;
        const convoList = (data.conversations ?? []) as ConversationSummary[];
        setConversations(convoList);

        // Prefer the DM deep-linked via /messages?user=<id>
        const requestedId =
          targetUserId && targetUserId !== user?.id ? targetUserId : null;

        if (requestedId) {
          const existing = convoList.find(
            (c) => c.other_user.id === requestedId
          );
          if (existing) {
            selectConversation(existing);
            return;
          }
          // No conversation yet — resolve the target's profile to start one.
          try {
            const ures = await fetch("/api/dm/users");
            if (ures.ok) {
              const udata = await ures.json();
              const target = (udata.users ?? []).find(
                (u: UserOption) => u.id === requestedId
              );
              if (target) {
                setMessages([]);
                setInput("");
                setActive({ conversationId: null, recipient: target });
                activeConversationIdRef.current = null;
                return;
              }
            }
          } catch {
            // fall through to the default below
          }
        }

        if (convoList.length) {
          // open the most recent conversation automatically
          const first = convoList[0] as ConversationSummary;
          activeConversationIdRef.current = first.conversation_id;
          setActive({
            conversationId: first.conversation_id,
            recipient: {
              id: first.other_user.id,
              username: first.other_user.username,
              avatar: first.other_user.avatar,
              role: first.other_user.role,
            },
          });
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages for the active conversation + mark read
  useEffect(() => {
    const conversationId = active?.conversationId;
    if (!conversationId) return;
    activeConversationIdRef.current = conversationId;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/dm/messages?conversation_id=${encodeURIComponent(conversationId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMessages(data.messages ?? []);

        await fetch("/api/dm/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        });
        fetchConversations();
      } catch {
        // best-effort
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active?.conversationId, fetchConversations]);

  // Jump to the latest message once when opening a conversation —
  // no auto-scroll on new messages, so users can scroll freely.
  const scrolledConvoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active?.conversationId || !messages.length) return;
    if (scrolledConvoRef.current === active.conversationId) return;
    scrolledConvoRef.current = active.conversationId;
    rememberOpenScroll();
    const id = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(id);
  }, [active?.conversationId, messages.length, scrollToBottom, rememberOpenScroll]);

  // Keep the "jump to latest" button in sync when the message list changes —
  // e.g. a new message arrives while the user is reading older messages.
  useEffect(() => {
    if (!messages.length) return;
    return refreshPosition();
  }, [active?.conversationId, messages, refreshPosition]);

  // When the user taps a reply preview whose original message isn't loaded,
  // it is fetched and inserted; this ref holds the id until it shows up in
  // the list, then we scroll to it.
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
      // Message missing from the loaded conversation — fetch it by id.
      try {
        const res = await fetch(
          `/api/dm/messages?message_id=${encodeURIComponent(messageId)}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = await res.json();
        const fetched = data.message as DMChat | null;
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

  const openNewPicker = async () => {
    setShowNewPicker((prev) => !prev);
    setSearchTerm("");
    if (userOptions.length === 0) {
      setPickerLoading(true);
      try {
        const res = await fetch("/api/dm/users");
        if (res.ok) {
          const data = await res.json();
          setUserOptions((data.users ?? []) as UserOption[]);
        }
      } catch {
        // best-effort
      } finally {
        setPickerLoading(false);
      }
    }
  };

  const pickUser = (option: UserOption) => {
    const existing = conversations.find((c) => c.other_user.id === option.id);
    setShowNewPicker(false);
    setReplyTo(null);
    setReactFor(null);
    if (existing) {
      selectConversation(existing);
    } else {
      setMessages([]);
      setInput("");
      setActive({ conversationId: null, recipient: option });
      activeConversationIdRef.current = null;
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    const recipientId = active?.recipient.id;
    if (!recipientId || (!content && sending)) return;
    if (!content) return;

    // Editing an existing message instead of sending a new one.
    if (editingMsg) {
      setSending(true);
      setConvoError(null);
      try {
        const res = await fetch(`/api/dm/messages/${encodeURIComponent(editingMsg.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setConvoError(data?.error || "Could not edit message");
          return;
        }
        const updated = data?.message as DMChat | null;
        if (updated) {
          setMessages((prev) =>
            prev.map((m) => (m.id === editingMsg.id ? updated : m))
          );
        }
        setEditingMsg(null);
        setInput("");
        fetchConversations();
        jumpToBottom();
      } catch {
        setConvoError("Could not edit message");
      } finally {
        setSending(false);
      }
      return;
    }

    const replyId = replyTo?.id ?? null;
    setSending(true);
    setConvoError(null);
    try {
      const res = await fetch("/api/dm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, content, replyToId: replyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConvoError(data.error || "Could not send message");
        return;
      }
      setMessages((prev) => [...prev, data.message as DMChat]);
      if (replyTo) setReplyTo(null);
      if (!active.conversationId) {
        setActive({
          conversationId: data.conversationId as string,
          recipient: active.recipient,
        });
        activeConversationIdRef.current = data.conversationId as string;
      }
      setInput("");
      setShowEmoji(false);
      fetchConversations();
    } catch {
      setConvoError("Could not send message");
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const recipientId = active?.recipient.id;
    if (!file || isUploading || !recipientId) return;
    if (user?.restricted_at) {
      window.alert("You have limited access, try again later");
      return;
    }
    setConvoError(null);
    setIsUploading(true);
    setUploadError("");
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await uploadWithProgress(
        "/api/dm/messages/upload-image",
        formData,
        setUploadProgress
      );
      if (!res.ok) {
        throw new Error(uploadErrorOf(res, `HTTP error! status: ${res.status}`));
      }
      const url = res.data?.url;
      if (typeof url === "string") {
        const res2 = await fetch("/api/dm/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId,
            content: "",
            mediaUrl: url,
            replyToId: replyTo?.id ?? null,
          }),
        });
        const data = await res2.json();
        if (!res2.ok) {
          throw new Error(data.error || "Could not send message");
        }
        setMessages((prev) => [...prev, data.message as DMChat]);
        if (replyTo) setReplyTo(null);
        if (!active.conversationId) {
          setActive({
            conversationId: data.conversationId as string,
            recipient: active.recipient,
          });
          activeConversationIdRef.current = data.conversationId as string;
        }
        setShowEmoji(false);
        fetchConversations();
        jumpToBottom();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload image");
      console.error("Failed to send image:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user || user.restricted_at) return;
      try {
        const res = await fetch(`/api/dm/messages/${messageId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
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

  const startEdit = (msg: DMChat) => {
    setEditingMsg(msg);
    setInput(msg.content);
    setReplyTo(null);
    setReactFor(null);
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

  const deleteMessageRow = async (msg: DMChat): Promise<boolean> => {
    try {
      const res = await fetch(`/api/dm/messages/${encodeURIComponent(msg.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.warn(data?.error ?? "Failed to delete message");
        return false;
      }
      const data = await res.json();
      const updated = data?.message as DMChat | null;
      if (updated) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }
      if (replyTo?.id === msg.id) setReplyTo(null);
      if (editingMsg?.id === msg.id) cancelEdit();
      fetchConversations();
      return true;
    } catch (e) {
      console.error("Failed to delete message:", e);
      return false;
    }
  };

  const filteredUsers = userOptions.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // ── Render ───────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-73px)] supports-[height:100dvh]:h-[calc(100dvh-73px)]">
      {/* Conversations list — full-width on phones until a chat is opened */}
      <aside
        className={cn(
          "w-full max-w-[300px] flex-col border-r border-border bg-zinc-900/30",
          !active || showNewPicker ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <button
            onClick={openNewPicker}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30 transition hover:bg-primary/25"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {showNewPicker ? (
          <div className="flex-1 overflow-y-auto p-3">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-full border border-border bg-zinc-900 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary/50"
              />
            </div>
            {pickerLoading ? (
              <div className="flex justify-center py-8 text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-secondary">
                No users found
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredUsers.map((option) => (
                  <li key={option.id}>
                    <button
                      onClick={() => pickUser(option)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
                    >
                      <img
                        src={resolveAvatarUrl(option.avatar)}
                        alt={option.username}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {option.username}
                      </span>
                      {option.role === "artist" && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          Artist
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageCircle className="h-8 w-8 text-secondary" />
            <p className="text-sm text-secondary">
              No conversations yet. Start one with the New button.
            </p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {conversations.map((convo) => (
              <li key={convo.conversation_id}>
                <button
                  onClick={() => selectConversation(convo)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/5",
                    active?.conversationId === convo.conversation_id && "bg-white/5"
                  )}
                >
                  <img
                    src={resolveAvatarUrl(convo.other_user.avatar)}
                    alt={convo.other_user.username}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {convo.other_user.username}
                      </span>
                      <span className="shrink-0 text-[11px] text-secondary">
                        {formatTime(convo.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-secondary">
                        {convo.last_sender_id === user?.id && "You: "}
                        {convo.last_message}
                      </p>
                      {convo.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                          {convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Chat window — full-width on phones while a chat is open */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          !active || showNewPicker ? "hidden lg:flex" : "flex"
        )}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-secondary">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Back to inbox"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition hover:bg-white/10 lg:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <img
                src={resolveAvatarUrl(active.recipient.avatar)}
                alt={active.recipient.username}
                className="h-9 w-9 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold">{active.recipient.username}</p>
                {active.recipient.role === "artist" && (
                  <span className="text-[11px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                    Artist
                  </span>
                )}
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <div
                ref={setContainerRef}
                className="absolute inset-0 space-y-3 overflow-y-auto p-4"
              >
                {messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-secondary">
                    Say hello to {active.recipient.username}!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const mine = msg.sender_id === user?.id;
                    const repliedTo = messagesById.get(msg.reply_to_id ?? "") ?? null;
                    return (
                      <DmBubble
                        key={msg.id}
                        msg={msg}
                        mine={mine}
                        repliedTo={repliedTo}
                        replyToId={msg.reply_to_id ?? null}
                        repliedToLabel={
                          repliedTo
                            ? repliedTo.sender_id === user?.id
                              ? "You"
                              : active.recipient.username
                            : null
                        }
                        highlighted={highlightedId === msg.id}
                        disabled={!!user?.restricted_at || !!msg.deleted_at}
                        toggleReaction={toggleReaction}
                        setReplyTo={setReplyTo}
                        setReactFor={setReactFor}
                        setPreview={setPreview}
                        onJumpToReply={jumpToMessage}
                        onEdit={startEdit}
                        onDeleteMessage={deleteMessageRow}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <JumpToLatest show={showJumpToLatest} onClick={jumpToBottom} />
            </div>

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
                      React to {reactFor.sender_id === user?.id ? "your message" : active.recipient.username}
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

            <div className="border-t border-border p-3">
              {user?.restricted_at ? (
                <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  <EyeOff className="h-4 w-4 shrink-0" /> Your account is view-only —
                  you can browse but not send messages.
                </p>
              ) : (
                <>
                  {convoError && (
                    <p className="mb-2 text-xs text-red-500">{convoError}</p>
                  )}
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
                            Replying to{" "}
                            {replyTo.sender_id === user?.id
                              ? "yourself"
                              : active.recipient.username}
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
                          <p className="truncate text-xs text-secondary">
                            {editingMsg.content || ""}
                          </p>
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
                  <AnimatePresence>
                    {showEmoji && (
                      <motion.div
                        ref={emojiPanelRef}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b border-border bg-zinc-900 p-3"
                      >
                        <EmojiPicker
                          onPick={(emoji) =>
                            setInput((prev) => prev + emoji)
                          }
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                  >
                    {isUploading ? (
                      <UploadProgress
                        percent={uploadProgress}
                        size={40}
                        label="Uploading…"
                        className="mx-auto"
                      />
                    ) : (
                      <>
                        <button
                          ref={emojiToggleRef}
                          type="button"
                          onClick={() => setShowEmoji((v) => !v)}
                          className={cn(
                            "inline-flex h-10 w-10 items-center justify-center rounded-full transition",
                            showEmoji
                              ? "bg-primary text-white"
                              : "text-secondary hover:bg-white/10"
                          )}
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-secondary transition hover:bg-white/10 disabled:opacity-50"
                          aria-label="Send an image"
                          title="Send an image"
                        >
                          <ImageIcon className="h-5 w-5" />
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => {
                            setInput(e.target.value);
                            if (convoError) setConvoError(null);
                            if (uploadError) setUploadError("");
                          }}
                          placeholder={editingMsg ? "Edit message…" : replyTo ? "Reply…" : `Message ${active.recipient.username}...`}
                          className="flex-1 rounded-full border border-border bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-primary/50"
                        />
                        <button
                          type="submit"
                          disabled={sending || !input.trim()}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                          {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : editingMsg ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                        </button>
                      </>
                    )}
                  </form>
                </>
              )}
            </div>
          </>
        )}
      </section>
      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}