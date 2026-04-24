"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPicker } from "./user-picker";
import { FormActions } from "./form-actions";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Prefill {
  nonConformanceDescription?: string;
  fromMessageId?: string;
}

interface Props {
  isAdmin: boolean;
  users?: UserOption[];
  prefill?: Prefill;
}

export function NCRForm({ isAdmin, users, prefill }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignedInvestigatorId, setAssignedInvestigatorId] = useState("");
  const [secondaryInvestigatorId, setSecondaryInvestigatorId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      partNumber: formData.get("partNumber") || null,
      drawingNumber: formData.get("drawingNumber") || null,
      drawingRevision: formData.get("drawingRevision") || null,
      quantityAffected: formData.get("quantityAffected") || null,
      vendor: formData.get("vendor") || null,
      otherInfo: formData.get("otherInfo") || null,
      ncrType: formData.get("ncrType"),
      requirementDescription: formData.get("requirementDescription"),
      nonConformanceDescription: formData.get("nonConformanceDescription"),
      disposition: formData.get("disposition") || null,
      immediateAction: formData.get("immediateAction") || null,
      ncrTagNumber: formData.get("ncrTagNumber") || null,
      plantLocation: formData.get("plantLocation") || null,
      assignedInvestigatorId: assignedInvestigatorId || null,
      secondaryInvestigatorId: secondaryInvestigatorId || null,
      fromMessageId: prefill?.fromMessageId,
    };

    const res = await fetch("/api/ncrs", {
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

    router.push("/ncrs");
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
        submitLabel="Create NCR"
        loadingLabel="Creating..."
        cancelHref="/ncrs"
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Part # or Process Description
          </label>
          <input
            id="partNumber"
            name="partNumber"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., P/N 12345 or Assembly Process"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="drawingNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Drawing #
            </label>
            <input
              id="drawingNumber"
              name="drawingNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Drawing number"
            />
          </div>
          <div>
            <label htmlFor="drawingRevision" className="block text-sm font-medium text-gray-700 mb-1">
              Rev
            </label>
            <input
              id="drawingRevision"
              name="drawingRevision"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Revision"
            />
          </div>
          <div>
            <label htmlFor="quantityAffected" className="block text-sm font-medium text-gray-700 mb-1">
              Qty Affected
            </label>
            <input
              id="quantityAffected"
              name="quantityAffected"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Quantity"
            />
          </div>
        </div>

        <div>
          <label htmlFor="vendor" className="block text-sm font-medium text-gray-700 mb-1">
            Vendor if Applicable
          </label>
          <input
            id="vendor"
            name="vendor"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Vendor name"
          />
        </div>

        <div>
          <label htmlFor="otherInfo" className="block text-sm font-medium text-gray-700 mb-1">
            Other Info
          </label>
          <input
            id="otherInfo"
            name="otherInfo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Any additional information"
          />
        </div>

        <div>
          <label htmlFor="ncrType" className="block text-sm font-medium text-gray-700 mb-1">
            NCR Type *
          </label>
          <select
            id="ncrType"
            name="ncrType"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type...</option>
            <option value="aesthetic">Aesthetic</option>
            <option value="dimensional">Dimensional</option>
            <option value="function">Function</option>
            <option value="quality">Quality</option>
            <option value="safety">Safety</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>

        {users && users.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UserPicker
              users={users}
              value={assignedInvestigatorId}
              onChange={setAssignedInvestigatorId}
              label="Assigned Investigator"
              placeholder="Select investigator..."
            />
            <UserPicker
              users={users}
              value={secondaryInvestigatorId}
              onChange={setSecondaryInvestigatorId}
              label="Secondary Investigator"
              placeholder="Select secondary investigator..."
            />
          </div>
        )}

        <div>
          <label htmlFor="requirementDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Describe the Requirement or Specification *
          </label>
          <textarea
            id="requirementDescription"
            name="requirementDescription"
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the requirement or specification that was not met..."
          />
        </div>

        <div>
          <label htmlFor="nonConformanceDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Describe the Non-Conformance *
          </label>
          <textarea
            id="nonConformanceDescription"
            name="nonConformanceDescription"
            required
            rows={4}
            defaultValue={prefill?.nonConformanceDescription ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe how the item or process does not conform..."
          />
        </div>

        <div>
          <label htmlFor="disposition" className="block text-sm font-medium text-gray-700 mb-1">
            Recommended Disposition
          </label>
          <select
            id="disposition"
            name="disposition"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select disposition...</option>
            <option value="rework">Re-Work</option>
            <option value="return_to_vendor">Return to Vendor</option>
            <option value="scrap">Scrap</option>
            <option value="use_as_is">Use As Is</option>
          </select>
        </div>

        <div>
          <label htmlFor="immediateAction" className="block text-sm font-medium text-gray-700 mb-1">
            Describe Immediate Action
          </label>
          <textarea
            id="immediateAction"
            name="immediateAction"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe any immediate actions taken..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ncrTagNumber" className="block text-sm font-medium text-gray-700 mb-1">
              NCR Tag #
            </label>
            <input
              id="ncrTagNumber"
              name="ncrTagNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tag number"
            />
          </div>
          <div>
            <label htmlFor="plantLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Location in Plant
            </label>
            <input
              id="plantLocation"
              name="plantLocation"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Plant location"
            />
          </div>
        </div>
      </div>

      <FormActions
        loading={loading}
        submitLabel="Create NCR"
        loadingLabel="Creating..."
        cancelHref="/ncrs"
      />
    </form>
  );
}
