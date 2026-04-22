"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

interface Props {
  scheduleId: string;
  scheduleTitle: string;
}

export function ScheduleCompleteButton({ scheduleId, scheduleTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [result, setResult] = useState<{ newNextDue: string } | null>(null);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
          partsUsed: partsUsed || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to complete");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      setShowForm(false);
      setNotes("");
      setPartsUsed("");
      router.refresh();
    } catch {
      alert("Failed to complete maintenance");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-700 mb-1">
          <CheckCircle size={16} />
          <span className="font-medium text-sm">Maintenance completed</span>
        </div>
        <p className="text-sm text-green-600">
          Logged to maintenance history. Next due: {new Date(result.newNextDue).toLocaleDateString()}
        </p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
      >
        <CheckCircle size={16} />
        Mark Complete
      </button>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Complete: {scheduleTitle}
      </p>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Any notes about the work performed..."
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Parts Used (optional)</label>
        <input
          value={partsUsed}
          onChange={(e) => setPartsUsed(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="e.g., Oil filter, hydraulic fluid"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleComplete}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={14} />
          {loading ? "Completing..." : "Confirm Complete"}
        </button>
        <button
          onClick={() => setShowForm(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
