"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "backlog", label: "Backlog" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "needs_parts", label: "Needs Parts" },
  { value: "done", label: "Done" },
];

export function ScheduleRowActions({
  scheduleId,
  scheduleTitle,
  currentStatus,
}: {
  scheduleId: string;
  scheduleTitle: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [working, setWorking] = useState(false);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setStatus(next);
    setWorking(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardStatus: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      // Revert on failure.
      setStatus(currentStatus);
      alert("Failed to update status");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete schedule "${scheduleTitle}"? This cannot be undone.`)) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Failed to delete schedule");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={handleStatusChange}
        disabled={working}
        onClick={(e) => e.stopPropagation()}
        className="px-2 py-1.5 border border-gray-300 rounded-md text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        aria-label="Change status"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={handleDelete}
        disabled={working}
        className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
        title="Delete schedule"
        aria-label={`Delete schedule ${scheduleTitle}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
