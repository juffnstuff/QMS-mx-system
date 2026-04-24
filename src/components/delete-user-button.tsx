"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteUserButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = confirm(
      `Delete ${userName}?\n\nAll records they created (work orders, projects, NCRs, CAPAs, complaints, maintenance logs) will be reassigned to you. Any optional assignments (leads, technicians, reviewer) will be cleared.\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed");
      router.refresh();
    } catch (err) {
      alert(
        `Failed to delete user: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium disabled:opacity-50"
    >
      <Trash2 size={12} />
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
