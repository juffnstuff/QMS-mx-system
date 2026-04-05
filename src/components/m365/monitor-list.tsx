"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface Monitor {
  id: string;
  sourceType: string;
  sourceId: string;
  displayName: string;
  isActive: boolean;
  lastPolledAt: Date | string | null;
}

export function MonitorList({ monitors }: { monitors: Monitor[] }) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [sourceType, setSourceType] = useState<"mailbox" | "teams_channel">("mailbox");
  const [sourceId, setSourceId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/m365/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId, displayName }),
      });
      if (!res.ok) throw new Error("Failed to add monitor");
      setShowAddForm(false);
      setSourceId("");
      setDisplayName("");
      router.refresh();
    } catch {
      setError("Failed to add monitor");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/m365/monitors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this monitor?")) return;
    await fetch(`/api/m365/monitors/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Monitored Sources</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          + Add Source
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as "mailbox" | "teams_channel")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="mailbox">Email Mailbox</option>
                <option value="teams_channel">Teams Channel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={sourceType === "mailbox" ? "Maintenance Inbox" : "#maintenance-alerts"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {sourceType === "mailbox" ? "Email Address" : "Team ID / Channel ID (format: teamId/channelId)"}
              </label>
              <input
                type="text"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder={
                  sourceType === "mailbox"
                    ? "maintenance@rubberform.com"
                    : "team-id/channel-id"
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Monitor"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {monitors.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No monitored sources yet</p>
          <p className="text-sm text-gray-400 mt-1">Add an email mailbox or Teams channel to start</p>
        </div>
      ) : (
        <div className="space-y-2">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    monitor.isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <div>
                  <p className="font-medium text-gray-900">{monitor.displayName}</p>
                  <p className="text-sm text-gray-500">
                    {monitor.sourceType === "mailbox" ? "Email" : "Teams"} &middot;{" "}
                    {monitor.sourceId}
                    {monitor.lastPolledAt && (
                      <> &middot; Last polled {format(new Date(monitor.lastPolledAt), "MMM d, h:mm a")}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(monitor.id, monitor.isActive)}
                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                    monitor.isActive
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {monitor.isActive ? "Active" : "Paused"}
                </button>
                <button
                  onClick={() => handleDelete(monitor.id)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
