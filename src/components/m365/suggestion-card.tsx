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
  flag_for_review: "Flag for Review",
};

const typeBadgeColors: Record<string, string> = {
  create_work_order: "bg-blue-100 text-blue-700",
  create_maintenance_log: "bg-green-100 text-green-700",
  update_equipment_status: "bg-orange-100 text-orange-700",
  create_project: "bg-indigo-100 text-indigo-700",
  flag_for_review: "bg-yellow-100 text-yellow-700",
};

const statusBadgeColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  auto_applied: "bg-purple-100 text-purple-700",
};

// Context-aware label for the first field in Proposed Action
const typeFieldLabels: Record<string, string> = {
  create_work_order: "Work Order",
  create_maintenance_log: "Maintenance Log",
  update_equipment_status: "Equipment",
  create_project: "Project",
  flag_for_review: "Item",
};

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parentEquipmentId, setParentEquipmentId] = useState<string>("");
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([]);
  const payload = JSON.parse(suggestion.payload);

  const isNewEquipment = payload.isNewEquipment && payload.equipmentId === "unknown";
  const showParentPicker = isNewEquipment && suggestion.status === "pending";

  // Fetch equipment list when parent picker is needed
  useEffect(() => {
    if (showParentPicker && expanded && equipmentList.length === 0) {
      fetch("/api/equipment")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setEquipmentList(data.map((e: EquipmentOption) => ({
              id: e.id,
              name: e.name,
              serialNumber: e.serialNumber,
            })));
          }
        })
        .catch(() => {});
    }
  }, [showParentPicker, expanded, equipmentList.length]);

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          parentEquipmentId: parentEquipmentId || undefined,
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

  const fieldLabel = typeFieldLabels[suggestion.suggestionType] || "Item";
  const isProject = suggestion.suggestionType === "create_project";

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
            <p className="font-medium text-gray-900 mt-1">{payload.title}</p>
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

          {/* Proposed Action */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Proposed Action</h4>
            <div className="bg-white p-3 rounded border border-gray-200 text-sm space-y-1">
              <p>
                <span className="text-gray-500">{fieldLabel}:</span>{" "}
                <span className="text-gray-900 font-medium">{payload.title || payload.equipmentName}</span>
                {isNewEquipment && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    New Equipment — will be registered on approval
                  </span>
                )}
              </p>
              {/* Show equipment context for work orders / maintenance logs */}
              {!isProject && payload.equipmentName && (
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
          {suggestion.status === "pending" && (
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
