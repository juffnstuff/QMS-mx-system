"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Periodic router.refresh() so updates made by other users (status changes,
// kanban moves, new records) surface without a manual reload. Skipped when the
// tab is hidden, when the user is typing in a field, when a dialog is open, or
// while a kanban drag is in progress (the kanban sets data-dragging="true" on
// the board during a drag).
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;

      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (active?.isContentEditable) return;

      if (document.querySelector('[data-dragging="true"]')) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
