"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

export function UserRoleToggle({
  userId,
  userName,
  currentRole,
}: {
  userId: string;
  userName: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    const newRole = currentRole === "admin" ? "operator" : "admin";
    const confirmed = window.confirm(
      `Change ${userName}'s role from ${currentRole} to ${newRole}?`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update role");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      <Shield size={12} />
      {loading ? "Updating..." : currentRole === "admin" ? "Demote to Operator" : "Promote to Admin"}
    </button>
  );
}
