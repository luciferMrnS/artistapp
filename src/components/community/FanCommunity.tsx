"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Image as ImageIcon, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { uploadWithProgress, uploadErrorOf } from "@/lib/upload";
import { UploadProgress } from "@/components/ui/UploadProgress";
import { Lightbox } from "@/components/ui/Lightbox";

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  content: string;
  message_type: "text" | "gif" | "image" | "sticker";
  media_url: string | null;
  created_at: string;
}

const EMOJI_LIST = [
  "\u{1F602}", "\u2764\uFE0F", "\u{1F525}", "\u{1F4AF}", "\u{1F62D}", "\u{1F44F}", "\u{1F389}", "\u{1F60E}", "\u{1F929}", "\u{1F4AA}",
  "\u{1F64C}", "\u{1F440}", "\u{1F923}", "\u{1F60D}", "\u{1F973}", "\u{1F624}", "\u{1F92F}", "\u{1F480}", "\u{1F451}", "\u2728",
  "\u{1F64F}", "\u{1F494}", "\u{1F608}", "\u{1F91D}", "\u{1F3B5}", "\u{1F3A4}", "\u{1F3A7}", "\u{1F3B6}", "\u{1F4F8}", "\u{1FAE1}",
];

const POLL_INTERVAL = 3000;

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

const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // While the user is pinned near the bottom, new polls keep them there;
  // once they scroll up to read older messages, polls stop stealing focus.
  const autoScrollRef = useRef(true);

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
    setInput("");
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
        body: JSON.stringify({ content, messageType: "text" }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP error! status: ${res.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
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
          body: JSON.stringify({ content: "", messageType: "image", mediaUrl: res.data.url }),
          credentials: "include"
        });
        if (!res2.ok) {
          const errorData2 = await res2.json().catch(() => ({ error: `HTTP error! status: ${res2.status}` }));
          throw new Error(errorData2.error || `HTTP error! status: ${res2.status}`);
        }
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

  const sendEmoji = async (emoji: string) => {
    setShowEmoji(false);
    if (isSending) return;
    if (user?.restricted_at) {
      window.alert("You have limited access, try again later");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: emoji, messageType: "text" }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Failed to send emoji: ${res.status}` }));
        throw new Error(errorData.error || `Failed to send emoji: ${res.status}`);
      }
      await fetchMessages();
    } catch (e) { console.error("Failed to send emoji:", e); }
    setIsSending(false);
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderContent = (msg: Message) => {
if (msg.message_type === "gif" || msg.message_type === "image") {
      return (
        <button
          type="button"
          onClick={() => setPreview(msg.media_url!)}
          aria-label="Open image full screen"
          className="block cursor-zoom-in"
        >
          <img src={msg.media_url!} alt="" className="max-w-[250px] rounded-lg" loading="lazy" />
        </button>
      );
    }
    return <span className="break-words">{msg.content}</span>;
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-secondary">Please sign in to join the fan community.</p>
      </div>
    );
  }

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
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn("flex gap-3", msg.user_id === user.id ? "flex-row-reverse" : "flex-row")}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                  msg.user_id === user.id ? "bg-primary" : "bg-gradient-to-br from-pink-500 to-purple-500"
                )}>
                  {msg.username.slice(0, 2).toUpperCase()}
                </div>
                <div className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2",
                  msg.user_id === user.id ? "bg-primary text-white" : "bg-white/10 text-white"
                )}>
                  <p className={cn("text-[10px] font-semibold", msg.user_id === user.id ? "text-white/80" : "text-primary")}>
                    {msg.username}
                  </p>
                  <div className="mt-0.5 text-sm">{renderContent(msg)}</div>
                  <p className={cn("mt-1 text-[10px]", msg.user_id === user.id ? "text-white/60" : "text-secondary")}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-zinc-900 p-3"
          >
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button key={emoji} onClick={() => sendEmoji(emoji)}
                  className="rounded-lg p-2 text-xl transition hover:bg-white/10">
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
              <button onClick={() => setShowEmoji(!showEmoji)}
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
                placeholder="Say something..."
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
