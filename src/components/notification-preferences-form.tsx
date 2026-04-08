"use client";

import { useState, useEffect } from "react";
import { SMS_CARRIERS } from "@/lib/notifications/carriers";

interface Prefs {
  phone: string | null;
  carrier: string | null;
  notifyEmail: boolean;
  notifySMS: boolean;
}

export function NotificationPreferencesForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/users/me/notifications")
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data);
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/users/me/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });

    if (res.ok) {
      setMessage("Preferences saved!");
    } else {
      setMessage("Failed to save preferences");
    }
    setSaving(false);
  }

  if (loading || !prefs) {
    return <p className="text-gray-500 text-sm">Loading preferences...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-md text-sm ${message.includes("Failed") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      {/* Email notifications */}
      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.notifyEmail}
            onChange={(e) => setPrefs({ ...prefs, notifyEmail: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Email Notifications</p>
            <p className="text-xs text-gray-500">Receive notifications via email</p>
          </div>
        </label>
      </div>

      {/* SMS notifications */}
      <div className="space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={prefs.notifySMS}
            onChange={(e) => setPrefs({ ...prefs, notifySMS: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">SMS/Text Notifications</p>
            <p className="text-xs text-gray-500">Receive text messages via carrier email gateway</p>
          </div>
        </label>

        {prefs.notifySMS && (
          <div className="ml-8 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={prefs.phone || ""}
                onChange={(e) => setPrefs({ ...prefs, phone: e.target.value.replace(/\D/g, "") })}
                placeholder="5551234567"
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">10-digit number, no dashes or spaces</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Carrier
              </label>
              <select
                value={prefs.carrier || ""}
                onChange={(e) => setPrefs({ ...prefs, carrier: e.target.value })}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <div className="pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  );
}
