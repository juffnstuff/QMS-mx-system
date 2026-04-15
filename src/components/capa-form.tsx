"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

interface ActionItem {
  description: string;
  responsibleParty: string;
  dueDate: string;
  status: string;
}

interface Props {
  users: { id: string; name: string }[];
  ncrs: { id: string; ncrNumber: string }[];
  isAdmin: boolean;
}

export function CAPAForm({ users, ncrs, isAdmin }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<ActionItem[]>([]);

  function addAction() {
    setActions([
      ...actions,
      { description: "", responsibleParty: "", dueDate: "", status: "planned" },
    ]);
  }

  function removeAction(index: number) {
    setActions(actions.filter((_, i) => i !== index));
  }

  function updateAction(index: number, field: keyof ActionItem, value: string) {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };
    setActions(updated);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      department: formData.get("department") || null,
      referenceNcrId: formData.get("referenceNcrId") || null,
      targetCloseDate: formData.get("targetCloseDate") || null,
      assignedToId: formData.get("assignedToId") || null,
      secondaryAssignedToId: formData.get("secondaryAssignedToId") || null,
      source: formData.get("source"),
      sourceOther: formData.get("sourceOther") || null,
      severityLevel: formData.get("severityLevel"),
      nonconformanceDescription: formData.get("nonconformanceDescription"),
      productProcessAffected: formData.get("productProcessAffected") || null,
      quantityScopeAffected: formData.get("quantityScopeAffected") || null,
      containmentActions: formData.get("containmentActions") || null,
      rcaMethod: formData.get("rcaMethod") || null,
      rcaMethodOther: formData.get("rcaMethodOther") || null,
      whyMan: formData.get("whyMan") || null,
      whyMachine: formData.get("whyMachine") || null,
      whyMethod: formData.get("whyMethod") || null,
      whyMaterial: formData.get("whyMaterial") || null,
      rootCauseStatement: formData.get("rootCauseStatement") || null,
      verificationMethod: formData.get("verificationMethod") || null,
      effectivenessOutcome: formData.get("effectivenessOutcome") || null,
      objectiveEvidence: formData.get("objectiveEvidence") || null,
      lessonsLearned: formData.get("lessonsLearned") || null,
      preventiveActions: formData.get("preventiveActions") || null,
      actions: actions.filter((a) => a.description.trim() !== ""),
    };

    const res = await fetch("/api/capas", {
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

    router.push("/capas");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl"
    >
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      {/* Section 1 — Identification */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Section 1 — Identification
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                Department / Process / Area
              </label>
              <input
                id="department"
                name="department"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Production, Quality, Shipping"
              />
            </div>
            <div>
              <label htmlFor="referenceNcrId" className="block text-sm font-medium text-gray-700 mb-1">
                Reference NCR No.
              </label>
              <select
                id="referenceNcrId"
                name="referenceNcrId"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {ncrs.map((ncr) => (
                  <option key={ncr.id} value={ncr.id}>
                    {ncr.ncrNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="targetCloseDate" className="block text-sm font-medium text-gray-700 mb-1">
                Target Close Date
              </label>
              <input
                id="targetCloseDate"
                name="targetCloseDate"
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="assignedToId" className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="secondaryAssignedToId" className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Responsible
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                Source of Nonconformance *
              </label>
              <select
                id="source"
                name="source"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select source...</option>
                <option value="internal_audit">Internal Audit</option>
                <option value="customer_complaint">Customer Complaint</option>
                <option value="supplier_issue">Supplier Issue</option>
                <option value="process_failure">Process Failure</option>
                <option value="product_defect">Product Defect</option>
                <option value="management_review">Management Review</option>
                <option value="regulatory_finding">Regulatory Finding</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="severityLevel" className="block text-sm font-medium text-gray-700 mb-1">
                Severity Level *
              </label>
              <select
                id="severityLevel"
                name="severityLevel"
                required
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

          <div>
            <label htmlFor="sourceOther" className="block text-sm font-medium text-gray-700 mb-1">
              Source — Other (specify)
            </label>
            <input
              id="sourceOther"
              name="sourceOther"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="If 'Other' selected above, specify here"
            />
          </div>
        </div>
      </div>

      {/* Section 2 — Problem Description */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Section 2 — Problem Description
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="nonconformanceDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Nonconformance Description * <span className="text-gray-400 font-normal">(What, Where, When, Extent)</span>
            </label>
            <textarea
              id="nonconformanceDescription"
              name="nonconformanceDescription"
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the nonconformance — what happened, where, when, and the extent..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="productProcessAffected" className="block text-sm font-medium text-gray-700 mb-1">
                Product / Process / Service Affected
              </label>
              <input
                id="productProcessAffected"
                name="productProcessAffected"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Rubber molding line #2"
              />
            </div>
            <div>
              <label htmlFor="quantityScopeAffected" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity / Scope Affected
              </label>
              <input
                id="quantityScopeAffected"
                name="quantityScopeAffected"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 500 units, 3 batches"
              />
            </div>
          </div>

          <div>
            <label htmlFor="containmentActions" className="block text-sm font-medium text-gray-700 mb-1">
              Immediate Containment Actions
            </label>
            <textarea
              id="containmentActions"
              name="containmentActions"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe immediate actions taken to contain the issue..."
            />
          </div>
        </div>
      </div>

      {/* Section 3 — Root Cause Analysis */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Section 3 — Root Cause Analysis
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rcaMethod" className="block text-sm font-medium text-gray-700 mb-1">
                RCA Method Used
              </label>
              <select
                id="rcaMethod"
                name="rcaMethod"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select method...</option>
                <option value="5_whys">5 Whys</option>
                <option value="fishbone">Fishbone (Ishikawa)</option>
                <option value="8d">8D</option>
                <option value="fault_tree">Fault Tree Analysis</option>
                <option value="pareto">Pareto Analysis</option>
                <option value="fmea">FMEA</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="rcaMethodOther" className="block text-sm font-medium text-gray-700 mb-1">
                RCA Method — Other (specify)
              </label>
              <input
                id="rcaMethodOther"
                name="rcaMethodOther"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="If 'Other' selected, specify here"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="whyMan" className="block text-sm font-medium text-gray-700 mb-1">
                Man / Human Factors
              </label>
              <textarea
                id="whyMan"
                name="whyMan"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Training, skill, fatigue, error..."
              />
            </div>
            <div>
              <label htmlFor="whyMachine" className="block text-sm font-medium text-gray-700 mb-1">
                Machine / Equipment
              </label>
              <textarea
                id="whyMachine"
                name="whyMachine"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Calibration, wear, malfunction..."
              />
            </div>
            <div>
              <label htmlFor="whyMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Method / Process
              </label>
              <textarea
                id="whyMethod"
                name="whyMethod"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Procedure, work instructions, SOP gaps..."
              />
            </div>
            <div>
              <label htmlFor="whyMaterial" className="block text-sm font-medium text-gray-700 mb-1">
                Material
              </label>
              <textarea
                id="whyMaterial"
                name="whyMaterial"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Raw material, supplier, specification..."
              />
            </div>
          </div>

          <div>
            <label htmlFor="rootCauseStatement" className="block text-sm font-medium text-gray-700 mb-1">
              Verified Root Cause Statement
            </label>
            <textarea
              id="rootCauseStatement"
              name="rootCauseStatement"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Clearly state the verified root cause..."
            />
          </div>
        </div>
      </div>

      {/* Section 4 — Corrective Action Plan */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
          Section 4 — Corrective Action Plan
        </h2>
        <div className="space-y-3">
          {actions.map((action, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-md p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  Action #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    value={action.description}
                    onChange={(e) =>
                      updateAction(index, "description", e.target.value)
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the corrective action..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Responsible Party
                    </label>
                    <input
                      value={action.responsibleParty}
                      onChange={(e) =>
                        updateAction(index, "responsibleParty", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Name or role"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={action.dueDate}
                      onChange={(e) =>
                        updateAction(index, "dueDate", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={action.status}
                      onChange={(e) =>
                        updateAction(index, "status", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                      <option value="verified">Verified</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addAction}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            <Plus size={16} />
            Add Action
          </button>
        </div>
      </div>

      {/* Section 5 — Effectiveness Verification (admin) */}
      {isAdmin && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Section 5 — Effectiveness Verification
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="verificationMethod" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Method
                </label>
                <input
                  id="verificationMethod"
                  name="verificationMethod"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Re-audit, sampling, review"
                />
              </div>
              <div>
                <label htmlFor="effectivenessOutcome" className="block text-sm font-medium text-gray-700 mb-1">
                  Effectiveness Outcome
                </label>
                <select
                  id="effectivenessOutcome"
                  name="effectivenessOutcome"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not yet determined</option>
                  <option value="effective">Effective</option>
                  <option value="partially_effective">Partially Effective</option>
                  <option value="ineffective">Ineffective</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="objectiveEvidence" className="block text-sm font-medium text-gray-700 mb-1">
                Objective Evidence
              </label>
              <textarea
                id="objectiveEvidence"
                name="objectiveEvidence"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Document objective evidence of effectiveness..."
              />
            </div>

            <div>
              <label htmlFor="lessonsLearned" className="block text-sm font-medium text-gray-700 mb-1">
                Lessons Learned
              </label>
              <textarea
                id="lessonsLearned"
                name="lessonsLearned"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Key takeaways and lessons learned..."
              />
            </div>

            <div>
              <label htmlFor="preventiveActions" className="block text-sm font-medium text-gray-700 mb-1">
                Preventive Actions / System Updates
              </label>
              <textarea
                id="preventiveActions"
                name="preventiveActions"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Preventive actions, system updates, procedure changes..."
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? "Creating..." : "Create CAPA"}
        </button>
        <Link href="/capas" className="text-gray-600 hover:text-gray-800 text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
