"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Prefill {
  description?: string;
  fromMessageId?: string;
}

interface Props {
  equipment: { id: string; name: string }[];
  defaultEquipmentId?: string;
  prefill?: Prefill;
}

export function MaintenanceLogForm({ equipment, defaultEquipmentId, prefill }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId: formData.get("equipmentId"),
      description: formData.get("description"),
      partsUsed: formData.get("partsUsed") || null,
      performedAt: formData.get("performedAt") || null,
      fromMessageId: prefill?.fromMessageId,
    };

    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/maintenance");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl"
    >
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="equipmentId" className="block text-sm font-medium text-gray-700 mb-1">
              Equipment *
            </label>
            <select
              id="equipmentId"
              name="equipmentId"
              required
              defaultValue={defaultEquipmentId || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select equipment...</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="performedAt" className="block text-sm font-medium text-gray-700 mb-1">
              Date Performed
            </label>
            <input
              id="performedAt"
              name="performedAt"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            What was done? *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            defaultValue={prefill?.description ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the maintenance performed..."
          />
        </div>

        <div>
          <label htmlFor="partsUsed" className="block text-sm font-medium text-gray-700 mb-1">
            Parts Used
          </label>
          <input
            id="partsUsed"
            name="partsUsed"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., 2x bearings, 1 gallon hydraulic fluid"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? "Saving..." : "Log Maintenance"}
        </button>
        <Link href="/maintenance" className="text-gray-600 hover:text-gray-800 text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
