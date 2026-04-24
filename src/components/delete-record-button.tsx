"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteRecordButtonProps {
  recordId: string;
  recordType: string; // e.g. "equipment", "work-orders", "ncrs", "capas", "complaints", "projects"
  recordLabel: string; // Display name for confirmation
  redirectTo: string; // Where to go after deletion
  compact?: boolean; // If true, icon-only button
}

export function DeleteRecordButton({
  recordId,
  recordType,
  recordLabel,
  redirectTo,
  compact = false,
}: DeleteRecordButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${recordLabel}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/${recordType}/${recordId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete");
        setLoading(false);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      alert("Failed to delete");
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleDelete}
        disabled={loading}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    );
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
    >
      <Trash2 size={14} />
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
