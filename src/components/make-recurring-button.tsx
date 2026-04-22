"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat } from "lucide-react";

interface Props {
  workOrderId: string;
  defaultTitle: string;
  defaultDescription: string;
  equipmentId: string;
  equipmentName: string;
}

export function MakeRecurringButton({
  workOrderId,
  defaultTitle,
  defaultDescription,
  equipmentId,
  equipmentName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId,
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      frequency: formData.get("frequency") as string,
      nextDue: formData.get("nextDue") as string,
      sourceWorkOrderId: workOrderId,
    };

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to create schedule");
      setLoading(false);
      return;
    }

    const result = await res.json();
    setSuccess(result);
    setLoading(false);
    router.refresh();
  }

  if (success) {
    return (
      <div className="text-sm">
        <p className="text-green-600 font-medium mb-1">Recurring schedule created!</p>
        <a href={`/schedules`} className="text-blue-600 hover:underline">
          View schedules &rarr;
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-100 transition-colors text-sm font-medium"
      >
        <Repeat size={16} />
        Make Recurring
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          name="title"
          required
          defaultValue={defaultTitle}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={defaultDescription}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-500 mb-1">
          Equipment: <span className="font-medium text-gray-900">{equipmentName}</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
          <select
            name="frequency"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
          <input
            name="nextDue"
            type="date"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? "Creating..." : "Create Schedule"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
