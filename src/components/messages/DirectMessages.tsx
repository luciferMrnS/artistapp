"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Plus, Loader2, MessageCircle, Search, EyeOff, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { UserDmLink } from "@/components/dm/UserDmLink";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { motion, AnimatePresence } from "framer-motion";
import { useDismissOnClickOutside } from "@/hooks/useDismissOnClickOutside";

interface DMChat {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  media_url: string | null;
  read: boolean;
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
  const [showNewPicker, setShowNewPicker] = useState(false);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [convoError, setConvoError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const selectConversation = (convo: ConversationSummary) => {
    setShowNewPicker(false);
    setShowEmoji(false);
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

    setSending(true);
    setConvoError(null);
    try {
      const res = await fetch("/api/dm/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConvoError(data.error || "Could not send message");
        return;
      }
      setMessages((prev) => [...prev, data.message as DMChat]);
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

  const filteredUsers = userOptions.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // ── Render ───────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Conversations list */}
      <aside className="flex w-full max-w-[300px] flex-col border-r border-border bg-zinc-900/30">
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

      {/* Chat window */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-secondary">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
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

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-secondary">
                  Say hello to {active.recipient.username}!
                </p>
              ) : (
                messages.map((msg) => {
                  const mine = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        mine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                          mine
                            ? "rounded-br-md bg-primary text-white"
                            : "rounded-bl-md bg-zinc-800 text-white"
                        )}
                      >
                        {msg.media_url ? (
                          <img
                            src={msg.media_url}
                            alt=""
                            className="mb-1 max-h-52 rounded-lg object-cover"
                          />
                        ) : null}
                        {msg.content}
                        <p
                          className={cn(
                            "mt-1 text-right text-[10px]",
                            mine ? "text-white/70" : "text-secondary"
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

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
                    <input
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        if (convoError) setConvoError(null);
                      }}
                      placeholder={`Message ${active.recipient.username}...`}
                      className="flex-1 rounded-full border border-border bg-zinc-900 px-4 py-2.5 text-sm outline-none transition focus:border-primary/50"
                    />
                    <button
                      type="submit"
                      disabled={sending || !input.trim()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}