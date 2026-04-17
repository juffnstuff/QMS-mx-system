"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface Suggestion {
  id: string;
  suggestionType: string;
  status: string;
  payload: string;
  createdRecordType: string | null;
  createdRecordId: string | null;
  reviewedAt: Date | string | null;
  reviewNote: string | null;
  createdAt: Date | string;
  processedMessage: {
    subject: string | null;
    senderName: string | null;
    senderEmail: string | null;
    bodyPreview: string;
    sourceType: string;
    receivedAt: Date | string;
    confidence: number | null;
  };
  reviewer: { name: string } | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  serialNumber: string;
}

const typeLabels: Record<string, string> = {
  create_work_order: "Create Work Order",
  create_maintenance_log: "Log Maintenance",
  update_equipment_status: "Update Equipment Status",
  create_project: "Create Project",
  create_auxiliary_equipment: "Create Auxiliary Equipment",
  progress_existing: "Progress Existing Record",
  flag_for_review: "Flag for Review",
};

const typeBadgeColors: Record<string, string> = {
  create_work_order: "bg-blue-100 text-blue-700",
  create_maintenance_log: "bg-green-100 text-green-700",
  update_equipment_status: "bg-orange-100 text-orange-700",
  create_project: "bg-indigo-100 text-indigo-700",
  create_auxiliary_equipment: "bg-cyan-100 text-cyan-700",
  progress_existing: "bg-purple-100 text-purple-700",
  flag_for_review: "bg-yellow-100 text-yellow-700",
};

const statusBadgeColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  auto_applied: "bg-purple-100 text-purple-700",
};

// Shape of the AI-proposed payload stored on the suggestion. All fields are
// optional because the AI only emits the ones relevant to the suggestion type.
interface SuggestionPayload {
  title?: string;
  description?: string;
  equipmentId?: string;
  equipmentName?: string;
  priority?: string;
  newStatus?: string;
  partsUsed?: string;
  budget?: string;
  isNewEquipment?: boolean;
  progressNote?: string;
  existingRecordType?: string;
  existingRecordId?: string;
  parentEquipmentId?: string;
  auxiliaryType?: string;
  autoCreateWorkOrder?: boolean;
}

// Editable fields tracked in local state — sent as `overrides` on approve.
interface EditableFields {
  title: string;
  description: string;
  priority: string;
  budget: string;
  newStatus: string;
  partsUsed: string;
  equipmentName: string;
  progressNote: string;
  equipmentId: string;
}

function initialEdits(payload: SuggestionPayload): EditableFields {
  return {
    title: payload.title || "",
    description: payload.description || "",
    priority: payload.priority || "medium",
    budget: payload.budget || "",
    newStatus: payload.newStatus || "",
    partsUsed: payload.partsUsed || "",
    equipmentName: payload.equipmentName || "",
    progressNote: payload.progressNote || "",
    equipmentId: payload.equipmentId || "",
  };
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-xs font-medium text-gray-600 mb-1";

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parentEquipmentId, setParentEquipmentId] = useState<string>("");
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([]);
  const payload: SuggestionPayload = JSON.parse(suggestion.payload);
  const [edits, setEdits] = useState<EditableFields>(() => initialEdits(payload));

  const isNewEquipment = payload.isNewEquipment && payload.equipmentId === "unknown";
  const isPending = suggestion.status === "pending";
  const showParentPicker = isNewEquipment && isPending;

  // Fetch equipment list whenever the expanded pending card might need it
  // (parent picker, or a manual equipment override).
  useEffect(() => {
    if (expanded && isPending && equipmentList.length === 0) {
      fetch("/api/equipment")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setEquipmentList(
              data.map((e: EquipmentOption) => ({
                id: e.id,
                name: e.name,
                serialNumber: e.serialNumber,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, [expanded, isPending, equipmentList.length]);

  function updateEdit<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  // Collect only the fields the user actually changed from the original payload.
  function buildOverrides(): Record<string, string> {
    const original = initialEdits(payload);
    const diff: Record<string, string> = {};
    for (const key of Object.keys(edits) as (keyof EditableFields)[]) {
      if (edits[key] !== original[key]) {
        diff[key] = edits[key];
      }
    }
    return diff;
  }

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      const overrides = action === "approve" ? buildOverrides() : undefined;
      const res = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          parentEquipmentId: parentEquipmentId || undefined,
          overrides: overrides && Object.keys(overrides).length > 0 ? overrides : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      alert("Failed to process suggestion");
    } finally {
      setLoading(false);
    }
  }

  const isProject = suggestion.suggestionType === "create_project";
  const isWorkOrder = suggestion.suggestionType === "create_work_order";
  const isAuxiliary = suggestion.suggestionType === "create_auxiliary_equipment";
  const isStatusUpdate = suggestion.suggestionType === "update_equipment_status";
  const isMaintLog = suggestion.suggestionType === "create_maintenance_log";
  const isProgress = suggestion.suggestionType === "progress_existing";
  const showPriority = isWorkOrder || isProject || isAuxiliary;
  const showBudget = isProject;
  const showPartsUsed = isMaintLog;
  const showNewStatus = isStatusUpdate;
  const showProgressNote = isProgress;
  const showEquipmentPicker =
    isPending &&
    !isProject &&
    !isProgress &&
    !isAuxiliary &&
    equipmentList.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  typeBadgeColors[suggestion.suggestionType] || "bg-gray-100 text-gray-600"
                }`}
              >
                {typeLabels[suggestion.suggestionType] || suggestion.suggestionType}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  statusBadgeColors[suggestion.status] || "bg-gray-100 text-gray-600"
                }`}
              >
                {suggestion.status === "auto_applied" ? "Auto-applied" : suggestion.status}
              </span>
              {suggestion.processedMessage.confidence !== null && (
                <span className="text-xs text-gray-400">
                  {Math.round(suggestion.processedMessage.confidence * 100)}% confidence
                </span>
              )}
            </div>
            <p className="font-medium text-gray-900 mt-1">{edits.title || payload.title}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              From: {suggestion.processedMessage.senderName || "Unknown"} &middot;{" "}
              {suggestion.processedMessage.sourceType === "email" ? "Email" : "Teams"} &middot;{" "}
              {format(new Date(suggestion.processedMessage.receivedAt), "MMM d, h:mm a")}
            </p>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Original Message */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Original Message</h4>
            <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-600">
              {suggestion.processedMessage.subject && (
                <p className="font-medium mb-1">{suggestion.processedMessage.subject}</p>
              )}
              <p className="whitespace-pre-wrap">{suggestion.processedMessage.bodyPreview}</p>
            </div>
          </div>

          {/* Proposed Action — editable when pending */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-700">Proposed Action</h4>
              {isPending && (
                <span className="text-xs text-gray-400">Edit any field before approving</span>
              )}
            </div>
            <div className="bg-white p-3 rounded border border-gray-200 text-sm">
              {isPending ? (
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Title</label>
                    <input
                      type="text"
                      value={edits.title}
                      onChange={(e) => updateEdit("title", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea
                      rows={3}
                      value={edits.description}
                      onChange={(e) => updateEdit("description", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {isNewEquipment && (
                    <div>
                      <label className={labelClass}>
                        Equipment name <span className="text-amber-600">(new — will be registered on approval)</span>
                      </label>
                      <input
                        type="text"
                        value={edits.equipmentName}
                        onChange={(e) => updateEdit("equipmentName", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                  {showEquipmentPicker && (
                    <div>
                      <label className={labelClass}>
                        {isNewEquipment ? "Or link to existing equipment instead" : "Equipment"}
                      </label>
                      <select
                        value={edits.equipmentId}
                        onChange={(e) => updateEdit("equipmentId", e.target.value)}
                        className={inputClass}
                      >
                        <option value="unknown">
                          {isNewEquipment ? "— register as new (use name above) —" : "— unknown —"}
                        </option>
                        {equipmentList.map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.name} ({eq.serialNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {showPriority && (
                      <div>
                        <label className={labelClass}>Priority</label>
                        <select
                          value={edits.priority}
                          onChange={(e) => updateEdit("priority", e.target.value)}
                          className={inputClass}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    )}
                    {showNewStatus && (
                      <div>
                        <label className={labelClass}>New status</label>
                        <select
                          value={edits.newStatus}
                          onChange={(e) => updateEdit("newStatus", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">— no change —</option>
                          <option value="operational">Operational</option>
                          <option value="needs_service">Needs Service</option>
                          <option value="down">Down</option>
                        </select>
                      </div>
                    )}
                    {showBudget && (
                      <div>
                        <label className={labelClass}>Budget</label>
                        <input
                          type="text"
                          value={edits.budget}
                          onChange={(e) => updateEdit("budget", e.target.value)}
                          className={inputClass}
                          placeholder="e.g., $12,000"
                        />
                      </div>
                    )}
                    {showPartsUsed && (
                      <div>
                        <label className={labelClass}>Parts used</label>
                        <input
                          type="text"
                          value={edits.partsUsed}
                          onChange={(e) => updateEdit("partsUsed", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                  {showProgressNote && (
                    <div>
                      <label className={labelClass}>Progress note to append</label>
                      <textarea
                        rows={2}
                        value={edits.progressNote}
                        onChange={(e) => updateEdit("progressNote", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p>
                    <span className="text-gray-500">Title:</span>{" "}
                    <span className="text-gray-900 font-medium">{payload.title}</span>
                  </p>
                  {payload.equipmentName && !isProject && (
                    <p>
                      <span className="text-gray-500">Equipment:</span>{" "}
                      <span className="text-gray-900">{payload.equipmentName}</span>
                    </p>
                  )}
                  <p>
                    <span className="text-gray-500">Description:</span>{" "}
                    <span className="text-gray-900">{payload.description}</span>
                  </p>
                  {payload.priority && (
                    <p>
                      <span className="text-gray-500">Priority:</span>{" "}
                      <span className="text-gray-900 capitalize">{payload.priority}</span>
                    </p>
                  )}
                  {payload.newStatus && (
                    <p>
                      <span className="text-gray-500">New Status:</span>{" "}
                      <span className="text-gray-900">{payload.newStatus.replace("_", " ")}</span>
                    </p>
                  )}
                  {payload.partsUsed && (
                    <p>
                      <span className="text-gray-500">Parts:</span>{" "}
                      <span className="text-gray-900">{payload.partsUsed}</span>
                    </p>
                  )}
                  {payload.budget && (
                    <p>
                      <span className="text-gray-500">Budget:</span>{" "}
                      <span className="text-gray-900">{payload.budget}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Parent Equipment Picker — for new sub-components */}
          {showParentPicker && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                Link as child component?
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                If this is a sub-component of existing equipment (e.g. a pump for a press), select the parent below.
              </p>
              <select
                value={parentEquipmentId}
                onChange={(e) => setParentEquipmentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No parent — register as standalone</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.serialNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Review Info */}
          {suggestion.reviewer && (
            <div className="mb-4 text-sm text-gray-500">
              Reviewed by {suggestion.reviewer.name}
              {suggestion.reviewedAt && (
                <> on {format(new Date(suggestion.reviewedAt), "MMM d, h:mm a")}</>
              )}
              {suggestion.reviewNote && <p className="mt-1">Note: {suggestion.reviewNote}</p>}
            </div>
          )}

          {/* Action Buttons */}
          {isPending && (
            <div className="flex gap-2">
              <button
                onClick={() => handleAction("approve")}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Approve & Create"}
              </button>
              <button
                onClick={() => handleAction("reject")}
                disabled={loading}
                className="px-4 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {/* Link to created record */}
          {suggestion.createdRecordId && suggestion.createdRecordType === "WorkOrder" && (
            <a
              href={`/work-orders/${suggestion.createdRecordId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View created work order &rarr;
            </a>
          )}
          {suggestion.createdRecordId && suggestion.createdRecordType === "Project" && (
            <a
              href={`/projects/${suggestion.createdRecordId}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              View created project &rarr;
            </a>
          )}
          {suggestion.createdRecordId && suggestion.createdRecordType === "Equipment" && (
            <a
              href={`/equipment/${suggestion.createdRecordId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View equipment &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
