"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  workOrderId: string;
  currentStatus: string;
  isAdmin: boolean;
}

const statusTransitions: Record<string, { label: string; value: string; color: string }[]> = {
  open: [
    { label: "Start Work", value: "in_progress", color: "bg-yellow-500 hover:bg-yellow-600" },
    { label: "Cancel", value: "cancelled", color: "bg-gray-500 hover:bg-gray-600" },
  ],
  in_progress: [
    { label: "Mark Complete", value: "completed", color: "bg-green-500 hover:bg-green-600" },
    { label: "Cancel", value: "cancelled", color: "bg-gray-500 hover:bg-gray-600" },
  ],
  completed: [],
  cancelled: [
    { label: "Reopen", value: "open", color: "bg-blue-500 hover:bg-blue-600" },
  ],
};

export function WorkOrderStatusUpdate({ workOrderId, currentStatus, isAdmin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const actions = statusTransitions[currentStatus] || [];
  // Only admin can cancel or reopen
  const filteredActions = isAdmin
    ? actions
    : actions.filter((a) => a.value !== "cancelled" && a.value !== "open");

  if (filteredActions.length === 0) return null;

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/work-orders/${workOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {filteredActions.map((action) => (
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
  );
}
