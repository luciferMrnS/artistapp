"use client";

import { cn } from "@/lib/utils";
import { EMOJI_LIST } from "@/lib/emoji-list";

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onPick, className }: EmojiPickerProps) {
  return (
    <div className={cn("grid grid-cols-10 gap-1", className)}>
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="rounded-lg p-2 text-xl transition hover:bg-white/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}