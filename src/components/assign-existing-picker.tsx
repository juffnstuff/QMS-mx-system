"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export interface AssignableRecord {
  id: string;
  label: string;
  // Populated when the target record is already assigned to someone — helps
  // the reviewer see they'd be replacing an existing assignee.
  currentPrimary?: string | null;
  currentSecondary?: string | null;
}

export function AssignExistingPicker({
  userId,
  userName,
  records,
  primaryField,
  secondaryField,
  primaryLabel,
  secondaryLabel,
  apiBase,
  recordLabel,
}: {
  userId: string;
  userName: string;
  records: AssignableRecord[];
  primaryField: string;
  secondaryField: string;
  primaryLabel: string;
  secondaryLabel: string;
  apiBase: string; // e.g. "/api/equipment"
  recordLabel: string; // e.g. "equipment" — used in UI copy
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [slot, setSlot] = useState<"primary" | "secondary">("primary");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!recordId) return;
    const field = slot === "primary" ? primaryField : secondaryField;
    const selected = records.find((r) => r.id === recordId);
    const currentSlot =
      slot === "primary" ? selected?.currentPrimary : selected?.currentSecondary;

    if (
      currentSlot &&
      !confirm(
        `That ${recordLabel}'s ${slot === "primary" ? primaryLabel.toLowerCase() : secondaryLabel.toLowerCase()} is currently ${currentSlot}. Replace with ${userName}?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${apiBase}/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Assignment failed");
      }
      setOpen(false);
      setRecordId("");
      setSlot("primary");
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setMessage("");
        }}
        disabled={records.length === 0}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        title={records.length === 0 ? `No ${recordLabel} available` : undefined}
      >
        <Plus size={12} /> Assign to existing {recordLabel}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-gray-50 border border-gray-200 rounded-md p-3 space-y-2 mt-2"
    >
      {message && (
        <div className="px-3 py-2 rounded-md text-xs bg-red-50 text-red-600">
          {message}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={recordId}
          onChange={(e) => setRecordId(e.target.value)}
          required
          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select {recordLabel}…</option>
          {records.map((r) => {
            const assigned =
              r.currentPrimary || r.currentSecondary
                ? ` — assigned to ${[r.currentPrimary, r.currentSecondary]
                    .filter(Boolean)
                    .join(" / ")}`
                : "";
            return (
              <option key={r.id} value={r.id}>
                {r.label}
                {assigned}
              </option>
            );
          })}
        </select>
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value as "primary" | "secondary")}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="primary">{primaryLabel}</option>
          <option value="secondary">{secondaryLabel}</option>
        </select>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !recordId}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Assigning..." : "Assign"}
        </button>
      </div>
    </form>
  );
}
