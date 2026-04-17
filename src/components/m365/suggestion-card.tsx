"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

type SuggestionKind = "maintenance" | "project" | "equipment" | "child_component";

interface Suggestion {
  id: string;
  suggestionType: string;
  kind: string | null;
  proposedFields: unknown; // Prisma Json? — parsed on the server, arrives as object|null
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
  location?: string;
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

const kindLabels: Record<SuggestionKind, string> = {
  maintenance: "Maintenance Schedule",
  project: "Project",
  equipment: "Equipment",
  child_component: "Child Component",
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

// Per-kind editable form values. Each kind uses only the subset it needs;
// unused fields stay empty strings so React inputs remain controlled.
interface ProjectFields {
  title: string;
  description: string;
  priority: string;
  status: string;
  budget: string;
  dueDate: string;
  keywords: string;
}

interface MaintenanceFields {
  title: string;
  equipmentId: string;
  description: string;
  frequency: string;
  nextDue: string;
}

interface EquipmentFields {
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
  criticality: string;
  equipmentClass: string;
  groupName: string;
  parentEquipmentId: string;
  notes: string;
}

interface ChildComponentFields {
  name: string;
  type: string;
  location: string;
  serialNumber: string;
  status: string;
  parentEquipmentId: string;
  notes: string;
}

interface KindFormState {
  project: ProjectFields;
  maintenance: MaintenanceFields;
  equipment: EquipmentFields;
  child_component: ChildComponentFields;
}

function pickString(obj: Record<string, unknown> | null, key: string, fallback = ""): string {
  if (!obj) return fallback;
  const v = obj[key];
  return typeof v === "string" ? v : fallback;
}

function inferKind(suggestion: Suggestion): SuggestionKind {
  if (
    suggestion.kind === "maintenance" ||
    suggestion.kind === "project" ||
    suggestion.kind === "equipment" ||
    suggestion.kind === "child_component"
  ) {
    return suggestion.kind;
  }
  switch (suggestion.suggestionType) {
    case "create_project":
      return "project";
    case "create_maintenance_log":
      return "maintenance";
    case "create_auxiliary_equipment":
      return "child_component";
    default:
      return "equipment";
  }
}

function initialKindForms(
  payload: SuggestionPayload,
  proposedFields: Record<string, unknown> | null
): KindFormState {
  const pf = proposedFields;
  return {
    project: {
      title: pickString(pf, "title", payload.title || ""),
      description: pickString(pf, "description", payload.description || ""),
      priority: pickString(pf, "priority", payload.priority || "medium"),
      status: pickString(pf, "status", "planning"),
      budget: pickString(pf, "budget", payload.budget || ""),
      dueDate: pickString(pf, "dueDate", ""),
      keywords: pickString(pf, "keywords", ""),
    },
    maintenance: {
      title: pickString(pf, "title", payload.title || ""),
      equipmentId: pickString(
        pf,
        "equipmentId",
        payload.equipmentId && payload.equipmentId !== "unknown" ? payload.equipmentId : ""
      ),
      description: pickString(pf, "description", payload.description || ""),
      frequency: pickString(pf, "frequency", "monthly"),
      nextDue: pickString(pf, "nextDue", ""),
    },
    equipment: {
      name: pickString(pf, "name", payload.equipmentName || payload.title || ""),
      type: pickString(pf, "type", ""),
      location: pickString(pf, "location", ""),
      serialNumber: pickString(pf, "serialNumber", ""),
      status: pickString(pf, "status", payload.newStatus || "needs_service"),
      criticality: pickString(pf, "criticality", "C"),
      equipmentClass: pickString(pf, "equipmentClass", ""),
      groupName: pickString(pf, "groupName", ""),
      parentEquipmentId: pickString(pf, "parentEquipmentId", payload.parentEquipmentId || ""),
      notes: pickString(pf, "notes", payload.description || ""),
    },
    child_component: {
      name: pickString(
        pf,
        "name",
        payload.equipmentName || payload.auxiliaryType || ""
      ),
      type: pickString(pf, "type", payload.auxiliaryType || "Component"),
      location: pickString(pf, "location", ""),
      serialNumber: pickString(pf, "serialNumber", ""),
      status: pickString(pf, "status", "needs_service"),
      parentEquipmentId: pickString(pf, "parentEquipmentId", payload.parentEquipmentId || ""),
      notes: pickString(pf, "notes", payload.description || ""),
    },
  };
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-xs font-medium text-gray-600 mb-1";

export function SuggestionCard({
  suggestion,
  equipment = [],
}: {
  suggestion: Suggestion;
  equipment?: EquipmentOption[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const equipmentList = equipment;
  const payload: SuggestionPayload = JSON.parse(suggestion.payload);

  const proposedFields =
    suggestion.proposedFields &&
    typeof suggestion.proposedFields === "object" &&
    !Array.isArray(suggestion.proposedFields)
      ? (suggestion.proposedFields as Record<string, unknown>)
      : null;

  const [kind, setKind] = useState<SuggestionKind>(() => inferKind(suggestion));
  const [forms, setForms] = useState<KindFormState>(() =>
    initialKindForms(payload, proposedFields)
  );

  const isPending = suggestion.status === "pending";

  function updateProject<K extends keyof ProjectFields>(key: K, value: ProjectFields[K]) {
    setForms((prev) => ({ ...prev, project: { ...prev.project, [key]: value } }));
  }
  function updateMaintenance<K extends keyof MaintenanceFields>(
    key: K,
    value: MaintenanceFields[K]
  ) {
    setForms((prev) => ({
      ...prev,
      maintenance: { ...prev.maintenance, [key]: value },
    }));
  }
  function updateEquipment<K extends keyof EquipmentFields>(
    key: K,
    value: EquipmentFields[K]
  ) {
    setForms((prev) => ({ ...prev, equipment: { ...prev.equipment, [key]: value } }));
  }
  function updateChild<K extends keyof ChildComponentFields>(
    key: K,
    value: ChildComponentFields[K]
  ) {
    setForms((prev) => ({
      ...prev,
      child_component: { ...prev.child_component, [key]: value },
    }));
  }

  // Convert the kind-specific form state into the `proposedFields` blob sent
  // to the approval endpoint. Empty strings are dropped so the server can tell
  // "unset" from "intentionally cleared".
  function buildProposedFields(): Record<string, unknown> {
    const raw: Record<string, unknown> =
      kind === "project"
        ? { ...forms.project }
        : kind === "maintenance"
          ? { ...forms.maintenance }
          : kind === "equipment"
            ? { ...forms.equipment }
            : { ...forms.child_component };
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && v === "") continue;
      cleaned[k] = v;
    }
    return cleaned;
  }

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "approve") {
        body.kind = kind;
        body.proposedFields = buildProposedFields();
      }
      const res = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed");
      }
      router.refresh();
    } catch (err) {
      alert(
        `Failed to process suggestion: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }

  const headerTitle = (() => {
    switch (kind) {
      case "project":
        return forms.project.title || payload.title;
      case "maintenance":
        return forms.maintenance.title || payload.title;
      case "equipment":
        return forms.equipment.name || payload.title;
      case "child_component":
        return forms.child_component.name || payload.title;
    }
  })();

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
            <p className="font-medium text-gray-900 mt-1">{headerTitle}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              From: {suggestion.processedMessage.senderName || "Unknown"} &middot;{" "}
              {suggestion.processedMessage.sourceType === "email" ? "Email" : "Teams"} &middot;{" "}
              {format(new Date(suggestion.processedMessage.receivedAt), "MMM d, h:mm a")}
            </p>
          </div>
          <span className="text-gray-400 text-sm">{expanded ? "\u25B2" : "\u25BC"}</span>
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
                    <label className={labelClass}>Kind</label>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as SuggestionKind)}
                      className={inputClass}
                    >
                      {(Object.keys(kindLabels) as SuggestionKind[]).map((k) => (
                        <option key={k} value={k}>
                          {kindLabels[k]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {kind === "project" && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Title</label>
                        <input
                          type="text"
                          value={forms.project.title}
                          onChange={(e) => updateProject("title", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                          rows={3}
                          value={forms.project.description}
                          onChange={(e) => updateProject("description", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Priority</label>
                          <select
                            value={forms.project.priority}
                            onChange={(e) => updateProject("priority", e.target.value)}
                            className={inputClass}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Status</label>
                          <select
                            value={forms.project.status}
                            onChange={(e) => updateProject("status", e.target.value)}
                            className={inputClass}
                          >
                            <option value="planning">Planning</option>
                            <option value="in_progress">In Progress</option>
                            <option value="on_hold">On Hold</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Budget</label>
                          <input
                            type="text"
                            value={forms.project.budget}
                            onChange={(e) => updateProject("budget", e.target.value)}
                            className={inputClass}
                            placeholder="e.g., $12,000"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Due date</label>
                          <input
                            type="date"
                            value={forms.project.dueDate}
                            onChange={(e) => updateProject("dueDate", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Keywords</label>
                        <input
                          type="text"
                          value={forms.project.keywords}
                          onChange={(e) => updateProject("keywords", e.target.value)}
                          className={inputClass}
                          placeholder="comma-separated synonyms for future email matching"
                        />
                      </div>
                    </div>
                  )}

                  {kind === "maintenance" && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Title</label>
                        <input
                          type="text"
                          value={forms.maintenance.title}
                          onChange={(e) => updateMaintenance("title", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Equipment</label>
                        <select
                          value={forms.maintenance.equipmentId}
                          onChange={(e) => updateMaintenance("equipmentId", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select equipment</option>
                          {equipmentList.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name} ({eq.serialNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                          rows={3}
                          value={forms.maintenance.description}
                          onChange={(e) => updateMaintenance("description", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Frequency</label>
                          <select
                            value={forms.maintenance.frequency}
                            onChange={(e) => updateMaintenance("frequency", e.target.value)}
                            className={inputClass}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="biannual">Biannual</option>
                            <option value="annual">Annual</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Next due</label>
                          <input
                            type="date"
                            value={forms.maintenance.nextDue}
                            onChange={(e) => updateMaintenance("nextDue", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {kind === "equipment" && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Name</label>
                        <input
                          type="text"
                          value={forms.equipment.name}
                          onChange={(e) => updateEquipment("name", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Type</label>
                          <input
                            type="text"
                            value={forms.equipment.type}
                            onChange={(e) => updateEquipment("type", e.target.value)}
                            className={inputClass}
                            placeholder="e.g., Press, Grinder, Forklift"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Location</label>
                          <input
                            type="text"
                            value={forms.equipment.location}
                            onChange={(e) => updateEquipment("location", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Serial number</label>
                          <input
                            type="text"
                            value={forms.equipment.serialNumber}
                            onChange={(e) => updateEquipment("serialNumber", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Status</label>
                          <select
                            value={forms.equipment.status}
                            onChange={(e) => updateEquipment("status", e.target.value)}
                            className={inputClass}
                          >
                            <option value="operational">Operational</option>
                            <option value="needs_service">Needs Service</option>
                            <option value="down">Down</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Criticality</label>
                          <select
                            value={forms.equipment.criticality}
                            onChange={(e) => updateEquipment("criticality", e.target.value)}
                            className={inputClass}
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Equipment class</label>
                          <input
                            type="text"
                            value={forms.equipment.equipmentClass}
                            onChange={(e) =>
                              updateEquipment("equipmentClass", e.target.value)
                            }
                            className={inputClass}
                            placeholder="e.g., presses, extruders"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Group name</label>
                          <input
                            type="text"
                            value={forms.equipment.groupName}
                            onChange={(e) => updateEquipment("groupName", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Parent equipment (optional)</label>
                          <select
                            value={forms.equipment.parentEquipmentId}
                            onChange={(e) =>
                              updateEquipment("parentEquipmentId", e.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="">No parent</option>
                            {equipmentList.map((eq) => (
                              <option key={eq.id} value={eq.id}>
                                {eq.name} ({eq.serialNumber})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Notes</label>
                        <textarea
                          rows={2}
                          value={forms.equipment.notes}
                          onChange={(e) => updateEquipment("notes", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {kind === "child_component" && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          Parent equipment <span className="text-red-600">(required)</span>
                        </label>
                        <select
                          value={forms.child_component.parentEquipmentId}
                          onChange={(e) => {
                            const parentId = e.target.value;
                            const parent = equipmentList.find((p) => p.id === parentId);
                            setForms((prev) => ({
                              ...prev,
                              child_component: {
                                ...prev.child_component,
                                parentEquipmentId: parentId,
                                // Default child location to parent's when the user
                                // hasn't set one — keeps the form ergonomic.
                                location:
                                  prev.child_component.location ||
                                  (parent?.location ?? ""),
                              },
                            }));
                          }}
                          className={inputClass}
                        >
                          <option value="">Select parent</option>
                          {equipmentList.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name} ({eq.serialNumber})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Name</label>
                        <input
                          type="text"
                          value={forms.child_component.name}
                          onChange={(e) => updateChild("name", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Type</label>
                          <input
                            type="text"
                            value={forms.child_component.type}
                            onChange={(e) => updateChild("type", e.target.value)}
                            className={inputClass}
                            placeholder="e.g., pump, motor, charger, VFD"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Location</label>
                          <input
                            type="text"
                            value={forms.child_component.location}
                            onChange={(e) => updateChild("location", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Serial number</label>
                          <input
                            type="text"
                            value={forms.child_component.serialNumber}
                            onChange={(e) => updateChild("serialNumber", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Status</label>
                          <select
                            value={forms.child_component.status}
                            onChange={(e) => updateChild("status", e.target.value)}
                            className={inputClass}
                          >
                            <option value="operational">Operational</option>
                            <option value="needs_service">Needs Service</option>
                            <option value="down">Down</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Notes</label>
                        <textarea
                          rows={2}
                          value={forms.child_component.notes}
                          onChange={(e) => updateChild("notes", e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p>
                    <span className="text-gray-500">Title:</span>{" "}
                    <span className="text-gray-900 font-medium">{payload.title}</span>
                  </p>
                  {payload.equipmentName && (
                    <p>
                      <span className="text-gray-500">Equipment:</span>{" "}
                      <span className="text-gray-900">{payload.equipmentName}</span>
                    </p>
                  )}
                  {payload.description && (
                    <p>
                      <span className="text-gray-500">Description:</span>{" "}
                      <span className="text-gray-900">{payload.description}</span>
                    </p>
                  )}
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
          {suggestion.createdRecordId &&
            suggestion.createdRecordType === "MaintenanceSchedule" && (
              <a
                href={`/maintenance/${suggestion.createdRecordId}`}
                className="text-sm text-green-600 hover:underline"
              >
                View maintenance schedule &rarr;
              </a>
            )}
        </div>
      )}
    </div>
  );
}
