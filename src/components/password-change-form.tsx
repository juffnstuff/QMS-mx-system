"use client";

import { useState } from "react";

export function PasswordChangeForm({ userId }: { userId: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (next !== confirm) {
      setMessage("Error: new passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(`Error: ${data.error || "failed"}`);
      } else {
        setMessage("Password updated");
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setMessage("Error: failed to update password");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      {message && (
        <div
          className={`px-3 py-2 rounded-md text-sm ${
            message.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}
      <div>
        <label className={labelClass}>Current password</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>New password</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-1">
          Minimum 8 characters, with uppercase, lowercase, and a number.
        </p>
      </div>
      <div>
        <label className={labelClass}>Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {loading ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}
