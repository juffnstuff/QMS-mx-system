"use client";

import { useState } from "react";
import { SMS_CARRIERS } from "@/lib/notifications/carriers";

interface Prefs {
  phone: string | null;
  carrier: string | null;
  notifyEmail: boolean;
  notifySMS: boolean;
}

// Admin-editable notification preferences for a given user. Used on the user
// detail page; the user's own settings page still uses the /me form.
export function UserNotificationsEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: Prefs;
}) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/users/${userId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setMessage("Saved.");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`px-3 py-2 rounded-md text-sm ${
            message.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
          }`}
        >
          {message}
        </div>
      )}

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={prefs.notifyEmail}
          onChange={(e) => setPrefs({ ...prefs, notifyEmail: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <p className="text-sm font-medium text-gray-900">Email Notifications</p>
          <p className="text-xs text-gray-500">Send notifications to their email</p>
        </div>
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.notifySMS}
            onChange={(e) => setPrefs({ ...prefs, notifySMS: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">SMS / Text Notifications</p>
            <p className="text-xs text-gray-500">Send texts via carrier email gateway</p>
          </div>
        </label>

        {prefs.notifySMS && (
          <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={prefs.phone || ""}
                onChange={(e) =>
                  setPrefs({ ...prefs, phone: e.target.value.replace(/\D/g, "") })
                }
                placeholder="5551234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">10 digits, no dashes</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Carrier
              </label>
              <select
                value={prefs.carrier || ""}
                onChange={(e) => setPrefs({ ...prefs, carrier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select carrier...</option>
                {SMS_CARRIERS.map((c) => (
                  <option key={c.domain} value={c.domain}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {saving ? "Saving..." : "Save notifications"}
      </button>
    </form>
  );
}
