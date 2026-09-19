"use client";

import React, { useState } from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface KebabMenuProps {
  /** Label of the delete action, e.g. "Delete post" */
  deleteLabel: string;
  /** Shown on the first delete click before confirming */
  confirmLabel?: string;
  /** Resolves true when the deletion succeeded */
  onDelete: () => Promise<boolean>;
  /** Optional edit action (shown above delete). Leave unset to hide it. */
  editLabel?: string;
  /** Runs when the edit action is selected */
  onEdit?: () => void;
  /** Which side of the trigger the menu drops out to */
  placement?: "bottom" | "top";
}

/**
 * Three-dot menu with an optional edit action and a two-step delete action.
 * First click on delete arms the confirm state; second click runs `onDelete`.
 */
export function KebabMenu({
  deleteLabel,
  confirmLabel = "Confirm delete",
  onDelete,
  editLabel = "Edit",
  onEdit,
  placement = "bottom",
}: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggle = () => {
    setOpen((o) => !o);
    setConfirming(false);
    setDeleting(false);
  };

  const handleEditClick = () => {
    setOpen(false);
    setConfirming(false);
    setDeleting(false);
    onEdit?.();
  };

  const handleDeleteClick = async () => {
    if (!open) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    const ok = await onDelete();
    if (ok) {
      setOpen(false);
      setConfirming(false);
      setDeleting(false);
    } else {
      // Keep the menu open so the user can retry
      setConfirming(false);
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={toggle}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="z-50 rounded-full p-2 text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 min-w-[170px] rounded-xl border border-border bg-zinc-900 p-1 shadow-xl ${
            placement === "top"
              ? "bottom-full mb-1"
              : "top-full mt-1"
          }`}
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={handleEditClick}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
              {editLabel}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? "Deleting..." : confirming ? confirmLabel : deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}