"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPicker } from "./user-picker";
import { FormActions } from "./form-actions";
import { DeleteRecordButton } from "./delete-record-button";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ScheduleData {
  id?: string;
  equipmentId: string;
  title: string;
  description: string | null;
  frequency: string;
  nextDue: string;
  assignedToId: string | null;
  secondaryAssignedToId: string | null;
}

interface Props {
  equipment: { id: string; name: string }[];
  users?: UserOption[];
  schedule?: ScheduleData;
}

export function ScheduleForm({ equipment, users, schedule }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignedToId, setAssignedToId] = useState(schedule?.assignedToId || "");
  const [secondaryAssignedToId, setSecondaryAssignedToId] = useState(schedule?.secondaryAssignedToId || "");
  const isEdit = !!schedule;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      equipmentId: formData.get("equipmentId"),
      title: formData.get("title"),
      description: formData.get("description") || null,
      frequency: formData.get("frequency"),
      nextDue: formData.get("nextDue"),
      assignedToId: assignedToId || null,
      secondaryAssignedToId: secondaryAssignedToId || null,
    };

    const url = isEdit ? `/api/schedules/${schedule.id}` : "/api/schedules";

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Something went wrong");
      setLoading(false);
      return;
    }

    if (isEdit) {
      router.push(`/schedules/${schedule.id}`);
    } else {
      router.push("/schedules");
    }
    router.refresh();
  }

  const cancelHref = isEdit ? `/schedules/${schedule?.id}` : "/schedules";
  const submitLabel = isEdit ? "Save Changes" : "Add Schedule";
  const loadingLabel = isEdit ? "Saving..." : "Creating...";

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
        submitLabel={submitLabel}
        loadingLabel={loadingLabel}
        cancelHref={cancelHref}
        deleteButton={isEdit ? (
          <DeleteRecordButton recordId={schedule!.id!} recordType="schedules" recordLabel={schedule!.title} redirectTo="/schedules" />
        ) : undefined}
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Schedule Title *
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={schedule?.title}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Blade inspection and sharpening"
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
              defaultValue={schedule?.equipmentId}
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
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
              Frequency *
            </label>
            <select
              id="frequency"
              name="frequency"
              required
              defaultValue={schedule?.frequency}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select frequency...</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="nextDue" className="block text-sm font-medium text-gray-700 mb-1">
            Next Due Date *
          </label>
          <input
            id="nextDue"
            name="nextDue"
            type="date"
            required
            defaultValue={schedule?.nextDue ? new Date(schedule.nextDue).toISOString().split("T")[0] : ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={schedule?.description || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional details about this maintenance task..."
          />
        </div>

        {users && users.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UserPicker
              users={users}
              value={assignedToId}
              onChange={setAssignedToId}
              label="Assigned To"
              placeholder="Select responsible person..."
            />
            <UserPicker
              users={users}
              value={secondaryAssignedToId}
              onChange={setSecondaryAssignedToId}
              label="Secondary Assignee"
              placeholder="Select secondary assignee..."
            />
          </div>
        )}
      </div>

      <FormActions
        loading={loading}
        submitLabel={submitLabel}
        loadingLabel={loadingLabel}
        cancelHref={cancelHref}
        deleteButton={isEdit ? (
          <DeleteRecordButton recordId={schedule!.id!} recordType="schedules" recordLabel={schedule!.title} redirectTo="/schedules" />
        ) : undefined}
      />
    </form>
  );
}
