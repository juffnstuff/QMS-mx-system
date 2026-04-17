"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPicker } from "./user-picker";
import { FormActions } from "./form-actions";
import { DeleteRecordButton } from "./delete-record-button";

interface EquipmentOption {
  id: string;
  name: string;
  serialNumber: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface EquipmentData {
  id?: string;
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
  criticality: string;
  equipmentClass: string | null;
  groupName: string | null;
  parentId: string | null;
  assignedTechnicianId: string | null;
  secondaryTechnicianId: string | null;
  notes: string | null;
}

const EQUIPMENT_CLASS_OPTIONS = [
  { value: "extruders", label: "Extruders & Production" },
  { value: "presses", label: "Compression Molding" },
  { value: "forklifts", label: "Forklifts & Material Handling" },
  { value: "utilities", label: "Utilities & Support" },
  { value: "other", label: "Other" },
] as const;

export function EquipmentForm({ equipment, allEquipment, users }: { equipment?: EquipmentData; allEquipment?: EquipmentOption[]; users?: UserOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(equipment?.assignedTechnicianId || "");
  const [secondaryTechnicianId, setSecondaryTechnicianId] = useState(equipment?.secondaryTechnicianId || "");
  const isEdit = !!equipment;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      location: formData.get("location") as string,
      serialNumber: formData.get("serialNumber") as string,
      status: formData.get("status") as string,
      criticality: formData.get("criticality") as string,
      equipmentClass: (formData.get("equipmentClass") as string) || null,
      groupName: (formData.get("groupName") as string) || null,
      parentId: (formData.get("parentId") as string) || null,
      assignedTechnicianId: assignedTechnicianId || null,
      secondaryTechnicianId: secondaryTechnicianId || null,
      notes: (formData.get("notes") as string) || null,
    };

    const url = isEdit
      ? `/api/equipment/${equipment.id}`
      : "/api/equipment";

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

    const result = await res.json();
    router.push(`/equipment/${result.id}`);
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
        submitLabel={isEdit ? "Save Changes" : "Add Equipment"}
        loadingLabel={isEdit ? "Saving..." : "Adding..."}
        cancelHref={isEdit ? `/equipment/${equipment?.id}` : "/equipment"}
        deleteButton={isEdit ? (
          <DeleteRecordButton recordId={equipment!.id!} recordType="equipment" recordLabel={equipment!.name} redirectTo="/equipment" />
        ) : undefined}
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Equipment Name *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={equipment?.name}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Granulator #1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <input
              id="type"
              name="type"
              required
              defaultValue={equipment?.type}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Granulator"
            />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              id="location"
              name="location"
              required
              defaultValue={equipment?.location}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Plant Floor - Bay 3"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number *
            </label>
            <input
              id="serialNumber"
              name="serialNumber"
              required
              defaultValue={equipment?.serialNumber}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="e.g., GRN-2024-001"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              id="status"
              name="status"
              defaultValue={equipment?.status || "operational"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="operational">Operational</option>
              <option value="needs_service">Needs Service</option>
              <option value="down">Down</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="criticality" className="block text-sm font-medium text-gray-700 mb-1">
              Criticality *
            </label>
            <select
              id="criticality"
              name="criticality"
              required
              defaultValue={equipment?.criticality || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select criticality...</option>
              <option value="A">Class A — Critical (production stoppage if down)</option>
              <option value="B">Class B — Important (degrades output, workaround possible)</option>
              <option value="C">Class C — General (non-critical, minimal impact)</option>
            </select>
          </div>
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
              Equipment Group
            </label>
            <input
              id="groupName"
              name="groupName"
              defaultValue={equipment?.groupName || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='e.g., "Dake Press System"'
            />
          </div>
        </div>

        <div>
          <label htmlFor="equipmentClass" className="block text-sm font-medium text-gray-700 mb-1">
            Equipment Class
          </label>
          <select
            id="equipmentClass"
            name="equipmentClass"
            defaultValue={equipment?.equipmentClass || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Uncategorized</option>
            {EQUIPMENT_CLASS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Used to group equipment into categories on the registry.
          </p>
        </div>

        {allEquipment && allEquipment.length > 0 && (
          <div>
            <label htmlFor="parentId" className="block text-sm font-medium text-gray-700 mb-1">
              Parent Equipment
            </label>
            <select
              id="parentId"
              name="parentId"
              defaultValue={equipment?.parentId || ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (top-level equipment)</option>
              {allEquipment
                .filter((e) => e.id !== equipment?.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.serialNumber})
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Select if this is a sub-component of another piece of equipment
            </p>
          </div>
        )}

        {users && users.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UserPicker
              users={users}
              value={assignedTechnicianId}
              onChange={setAssignedTechnicianId}
              label="Assigned Technician"
              placeholder="Select primary technician..."
            />
            <UserPicker
              users={users}
              value={secondaryTechnicianId}
              onChange={setSecondaryTechnicianId}
              label="Secondary Technician"
              placeholder="Select backup technician..."
            />
          </div>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={equipment?.notes || ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional notes about this equipment..."
          />
        </div>
      </div>

      <FormActions
        loading={loading}
        submitLabel={isEdit ? "Save Changes" : "Add Equipment"}
        loadingLabel={isEdit ? "Saving..." : "Adding..."}
        cancelHref={isEdit ? `/equipment/${equipment?.id}` : "/equipment"}
        deleteButton={isEdit ? (
          <DeleteRecordButton recordId={equipment!.id!} recordType="equipment" recordLabel={equipment!.name} redirectTo="/equipment" />
        ) : undefined}
      />
    </form>
  );
}
