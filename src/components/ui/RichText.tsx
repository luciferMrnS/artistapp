"use client";

import React from "react";
import { cn } from "@/lib/utils";

const URL_SPLIT_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_TEST_RE = /^(?:https?:\/\/|www\.)/i;
const MENTION_RE = /(@[\w.]+)/g;
const TRAILING_PUNCT = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", "'", '"']);

function normalizeHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function splitTrailingPunct(token: string): [string, string] {
  let end = token.length;
  while (end > 0 && TRAILING_PUNCT.has(token[end - 1])) end--;
  // Don't strip a lone "..." situation weirdly — just split.
  // Also keep balanced parens simple: strip trailing ) always (common case).
  return [token.slice(0, end), token.slice(end)];
}

function renderMentionParts(text: string, keyPrefix: string) {
  const parts = text.split(MENTION_RE);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-m${i}`;
    if (/^@[\w.]+$/i.test(part)) {
      if (part.toLowerCase() === "@all") {
        return (
          <span
            key={key}
            className="rounded-md bg-red-500/20 px-1.5 py-0.5 font-bold text-red-400 ring-1 ring-red-500/50"
          >
            {part}
          </span>
        );
      }
      return (
        <span key={key} className="font-semibold text-red-500">
          {part}
        </span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

interface RichTextProps {
  content: string;
  className?: string;
  /** Extra classes applied to auto-detected links */
  linkClassName?: string;
}

/**
 * Renders chat text with clickable links + @mention highlights.
 * - URLs (http(s)://… or www.…) become target=_blank anchors.
 * - @username / @all keep the existing Creed highlight styling.
 * - Plain text is preserved verbatim (whitespace handled by parent).
 */
export function RichText({ content, className, linkClassName }: RichTextProps) {
  const nodes: React.ReactNode[] = [];
  // Split with capture so URLs stay in the array at odd indices.
  const parts = content.split(URL_SPLIT_RE);

  let keyIdx = 0;
  for (const part of parts) {
    const keyBase = `p${keyIdx++}`;
    if (part && URL_TEST_RE.test(part)) {
      const [url, suffix] = splitTrailingPunct(part);
      if (!url) {
        nodes.push(<React.Fragment key={keyBase}>{part}</React.Fragment>);
        continue;
      }
      nodes.push(
        <a
          key={keyBase}
          href={normalizeHref(url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "break-all underline underline-offset-2 hover:opacity-80",
            linkClassName ?? "text-sky-400 hover:text-sky-300"
          )}
        >
          {url}
        </a>
      );
      if (suffix) nodes.push(<React.Fragment key={`${keyBase}-s`}>{suffix}</React.Fragment>);
    } else if (part) {
      nodes.push(
        <React.Fragment key={keyBase}>{renderMentionParts(part, keyBase)}</React.Fragment>
      );
    }
  }

  return <span className={cn("select-text whitespace-pre-wrap break-words", className)}>{nodes}</span>;
}
