"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  ncrId: string;
  currentStatus: string;
  currentDisposition: string | null;
}

const statusTransitions: Record<string, { label: string; value: string; color: string }[]> = {
  open: [
    { label: "Start Review", value: "under_review", color: "bg-yellow-500 hover:bg-yellow-600" },
    { label: "Close", value: "closed", color: "bg-gray-500 hover:bg-gray-600" },
  ],
  under_review: [
    { label: "Mark Dispositioned", value: "dispositioned", color: "bg-purple-500 hover:bg-purple-600" },
    { label: "Close", value: "closed", color: "bg-gray-500 hover:bg-gray-600" },
  ],
  dispositioned: [
    { label: "Close", value: "closed", color: "bg-green-500 hover:bg-green-600" },
  ],
  closed: [
    { label: "Reopen", value: "open", color: "bg-blue-500 hover:bg-blue-600" },
  ],
};

const dispositionOptions = [
  { label: "Re-Work", value: "rework" },
  { label: "Return to Vendor", value: "return_to_vendor" },
  { label: "Scrap", value: "scrap" },
  { label: "Use As Is", value: "use_as_is" },
];

export function NCRStatusUpdate({ ncrId, currentStatus, currentDisposition }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [disposition, setDisposition] = useState(currentDisposition || "");

  const actions = statusTransitions[currentStatus] || [];

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/ncrs/${ncrId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  async function updateDisposition() {
    if (!disposition) return;
    setLoading(true);
    await fetch(`/api/ncrs/${ncrId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disposition }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Update Disposition
        </label>
        <div className="flex gap-2">
          <select
            value={disposition}
            onChange={(e) => setDisposition(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select disposition...</option>
            {dispositionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={updateDisposition}
            disabled={loading || !disposition}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 transition-colors hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>

      {actions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Change Status
          </label>
          <div className="flex gap-2 flex-wrap">
            {actions.map((action) => (
              <button
                key={action.value}
                onClick={() => updateStatus(action.value)}
                disabled={loading}
                className={`${action.color} text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 transition-colors`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
