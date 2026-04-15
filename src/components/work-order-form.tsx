"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions } from "./form-actions";

interface Props {
  equipment: { id: string; name: string }[];
  users: { id: string; name: string }[];
  isAdmin: boolean;
}

export function WorkOrderForm({ equipment, users, isAdmin }: Props) {
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
      title: formData.get("title"),
      description: formData.get("description"),
      priority: formData.get("priority"),
      assignedToId: formData.get("assignedToId") || null,
      secondaryAssignedToId: formData.get("secondaryAssignedToId") || null,
      dueDate: formData.get("dueDate") || null,
      workOrderType: formData.get("workOrderType") || "corrective",
      requirements: (formData.get("requirements") as string) || null,
      plannedStartDate: (formData.get("plannedStartDate") as string) || null,
      managerNotes: (formData.get("managerNotes") as string) || null,
      estimatedBudget: (formData.get("estimatedBudget") as string) || null,
      estimatedLeadTime: (formData.get("estimatedLeadTime") as string) || null,
    };

    const res = await fetch("/api/work-orders", {
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

    router.push("/work-orders");
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

      <FormActions
        loading={loading}
        submitLabel="Create Work Order"
        loadingLabel="Creating..."
        cancelHref="/work-orders"
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            id="title"
            name="title"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Replace hydraulic seals"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="equipmentId" className="block text-sm font-medium text-gray-700 mb-1">
              Equipment *
            </label>
            <select
              id="equipmentId"
              name="equipmentId"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority *
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assignedToId" className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <select
              id="assignedToId"
              name="assignedToId"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="secondaryAssignedToId" className="block text-sm font-medium text-gray-700 mb-1">
              Secondary Assignee
            </label>
            <select
              id="secondaryAssignedToId"
              name="secondaryAssignedToId"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the work needed..."
          />
        </div>

        <div>
          <label htmlFor="workOrderType" className="block text-sm font-medium text-gray-700 mb-1">
            Work Order Type
          </label>
          <select
            id="workOrderType"
            name="workOrderType"
            defaultValue="corrective"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="routine">Routine</option>
            <option value="preventive">Preventive</option>
            <option value="corrective">Corrective</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div>
          <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-1">
            Requirements
          </label>
          <textarea
            id="requirements"
            name="requirements"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Please explain the end goal, specific requirements and detailed expectations"
          />
        </div>

        {isAdmin && (
          <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-800">Manager / Supervisor Fields</h3>

            <div>
              <label htmlFor="plannedStartDate" className="block text-sm font-medium text-gray-700 mb-1">
                Planned Start Date
              </label>
              <input
                id="plannedStartDate"
                name="plannedStartDate"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="managerNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Manager Notes
              </label>
              <textarea
                id="managerNotes"
                name="managerNotes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Supervisor/Manager notes and comments"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="estimatedBudget" className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Budget
                </label>
                <input
                  id="estimatedBudget"
                  name="estimatedBudget"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., $5,000"
                />
              </div>
              <div>
                <label htmlFor="estimatedLeadTime" className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Lead Time
                </label>
                <input
                  id="estimatedLeadTime"
                  name="estimatedLeadTime"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 2 weeks"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <FormActions
        loading={loading}
        submitLabel="Create Work Order"
        loadingLabel="Creating..."
        cancelHref="/work-orders"
      />
    </form>
  );
}
