"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/users/${userId}/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (res.ok) {
      setMessage("Password updated");
      setNewPassword("");
      setTimeout(() => {
        setShowForm(false);
        setMessage("");
      }, 2000);
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to update password");
    }
    setLoading(false);
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Reset Password
      </button>
    );
  }

  return (
    <form onSubmit={handleReset} className="flex items-center gap-2">
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={`New password for ${userName}`}
        className="px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 w-40"
        minLength={8}
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "..." : "Set"}
      </button>
      <button
        type="button"
        onClick={() => { setShowForm(false); setMessage(""); }}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
      {message && (
        <span className={`text-xs ${message === "Password updated" ? "text-green-600" : "text-red-600"}`}>
          {message}
        </span>
      )}
    </form>
  );
}
