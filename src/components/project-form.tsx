"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPicker } from "./user-picker";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

const RELEASE_CHECKLIST_ITEMS = [
  "manufacturingDrawings",
  "processSettings",
  "workInstructions",
  "operatorTraining",
  "maintenanceTraining",
  "inProcessDocuments",
  "productionControlDocuments",
  "criticalSpares",
] as const;

const RELEASE_CHECKLIST_LABELS: Record<string, string> = {
  manufacturingDrawings: "Manufacturing Drawings",
  processSettings: "Process Settings",
  workInstructions: "Work Instructions",
  operatorTraining: "Operator Training",
  maintenanceTraining: "Maintenance Training",
  inProcessDocuments: "In Process Documents",
  productionControlDocuments: "Production Control Documents",
  criticalSpares: "Critical Spares",
};

interface ProjectData {
  id?: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  budget: string | null;
  dueDate: string | null;
  projectLeadId?: string | null;
  phase?: string;
  projectJustification?: string | null;
  designObjectives?: string | null;
  designRequirements?: string | null;
  potentialVendors?: string | null;
  salesMarketingActions?: string | null;
  engineeringActions?: string | null;
  releaseChecklist?: string | null;
  actualBudget?: string | null;
  plannedSchedule?: string | null;
  actualSchedule?: string | null;
  isComplete?: string | null;
  contingentDetails?: string | null;
}

function parseChecklist(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function ProjectForm({ project, users }: { project?: ProjectData; users?: UserOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectLeadId, setProjectLeadId] = useState(project?.projectLeadId || "");
  const isEdit = !!project;

  const [phase1Open, setPhase1Open] = useState(true);
  const [phase2Open, setPhase2Open] = useState(false);
  const [phase3Open, setPhase3Open] = useState(false);

  const [isComplete, setIsComplete] = useState(project?.isComplete || "");
  const existingChecklist = parseChecklist(project?.releaseChecklist);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    // Build release checklist JSON
    const checklist: Record<string, string> = {};
    for (const item of RELEASE_CHECKLIST_ITEMS) {
      checklist[item] = (formData.get(`checklist_${item}`) as string) || "pending";
    }

    // plannedBudget in Phase 3 overrides top-level budget if provided
    const plannedBudget = formData.get("plannedBudget") as string;
    const topBudget = formData.get("budget") as string;

    const data = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      budget: plannedBudget || topBudget || null,
      dueDate: (formData.get("dueDate") as string) || null,
      projectLeadId: projectLeadId || null,
      phase: (formData.get("phase") as string) || "concept",
      projectJustification: (formData.get("projectJustification") as string) || null,
      designObjectives: (formData.get("designObjectives") as string) || null,
      designRequirements: (formData.get("designRequirements") as string) || null,
      potentialVendors: (formData.get("potentialVendors") as string) || null,
      salesMarketingActions: (formData.get("salesMarketingActions") as string) || null,
      engineeringActions: (formData.get("engineeringActions") as string) || null,
      releaseChecklist: JSON.stringify(checklist),
      actualBudget: (formData.get("actualBudget") as string) || null,
      plannedSchedule: (formData.get("plannedSchedule") as string) || null,
      actualSchedule: (formData.get("actualSchedule") as string) || null,
      isComplete: (formData.get("isComplete") as string) || null,
      contingentDetails: (formData.get("contingentDetails") as string) || null,
    };

    const url = isEdit ? `/api/projects/${project.id}` : "/api/projects";

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
    router.push(`/projects/${result.id}`);
    router.refresh();
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-3xl"
    >
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>
            Project Title *
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={project?.title}
            className={inputClass}
            placeholder="e.g., New Grinder Installation"
          />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={project?.description || ""}
            className={inputClass}
            placeholder="Project details, scope, goals..."
          />
        </div>

        {users && users.length > 0 && (
          <UserPicker
            users={users}
            value={projectLeadId}
            onChange={setProjectLeadId}
            label="Project Lead"
            placeholder="Select project lead..."
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={project?.status || "planning"}
              className={inputClass}
            >
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={labelClass}>
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={project?.priority || "medium"}
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label htmlFor="phase" className={labelClass}>
              Phase
            </label>
            <select
              id="phase"
              name="phase"
              defaultValue={project?.phase || "concept"}
              className={inputClass}
            >
              <option value="concept">Concept</option>
              <option value="design">Design &amp; Development</option>
              <option value="production_release">Production Release</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="budget" className={labelClass}>
              Budget
            </label>
            <input
              id="budget"
              name="budget"
              defaultValue={project?.budget || ""}
              className={inputClass}
              placeholder="e.g., $15,000"
            />
          </div>
          <div>
            <label htmlFor="dueDate" className={labelClass}>
              Due Date
            </label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={project?.dueDate ? project.dueDate.split("T")[0] : ""}
              className={inputClass}
            />
          </div>
        </div>

        {/* Phase 1: Project Concept */}
        <div className="border border-gray-200 rounded-md overflow-hidden mt-6">
          <button
            type="button"
            onClick={() => setPhase1Open(!phase1Open)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-sm font-semibold text-gray-800">Phase 1: Project Concept</span>
            <span className="text-gray-500 text-xs">{phase1Open ? "Collapse" : "Expand"}</span>
          </button>
          {phase1Open && (
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="projectJustification" className={labelClass}>
                  Project Justification
                </label>
                <textarea
                  id="projectJustification"
                  name="projectJustification"
                  rows={3}
                  defaultValue={project?.projectJustification || ""}
                  className={inputClass}
                  placeholder="Why is this project needed? Business case and justification..."
                />
              </div>
              <div>
                <label htmlFor="designObjectives" className={labelClass}>
                  Design Objectives
                </label>
                <textarea
                  id="designObjectives"
                  name="designObjectives"
                  rows={3}
                  defaultValue={project?.designObjectives || ""}
                  className={inputClass}
                  placeholder="What are the design objectives for this project?"
                />
              </div>
              <div>
                <label htmlFor="designRequirements" className={labelClass}>
                  Design Requirements / Specifications
                </label>
                <textarea
                  id="designRequirements"
                  name="designRequirements"
                  rows={3}
                  defaultValue={project?.designRequirements || ""}
                  className={inputClass}
                  placeholder="Specific design requirements and specifications..."
                />
              </div>
              <div>
                <label htmlFor="potentialVendors" className={labelClass}>
                  Potential Vendors and Contractors
                </label>
                <textarea
                  id="potentialVendors"
                  name="potentialVendors"
                  rows={2}
                  defaultValue={project?.potentialVendors || ""}
                  className={inputClass}
                  placeholder="List potential vendors and contractors..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Phase 2: Design & Development */}
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setPhase2Open(!phase2Open)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-sm font-semibold text-gray-800">Phase 2: Design &amp; Development</span>
            <span className="text-gray-500 text-xs">{phase2Open ? "Collapse" : "Expand"}</span>
          </button>
          {phase2Open && (
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="salesMarketingActions" className={labelClass}>
                  Sales &amp; Marketing Actions
                </label>
                <textarea
                  id="salesMarketingActions"
                  name="salesMarketingActions"
                  rows={3}
                  defaultValue={project?.salesMarketingActions || ""}
                  className={inputClass}
                  placeholder="Sales and marketing action items..."
                />
              </div>
              <div>
                <label htmlFor="engineeringActions" className={labelClass}>
                  Engineering Actions
                </label>
                <textarea
                  id="engineeringActions"
                  name="engineeringActions"
                  rows={3}
                  defaultValue={project?.engineeringActions || ""}
                  className={inputClass}
                  placeholder="Engineering action items (task descriptions, who is responsible, when)..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: Production Release */}
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setPhase3Open(!phase3Open)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-sm font-semibold text-gray-800">Phase 3: Production Release</span>
            <span className="text-gray-500 text-xs">{phase3Open ? "Collapse" : "Expand"}</span>
          </button>
          {phase3Open && (
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-800 mb-3">Release Checklist</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RELEASE_CHECKLIST_ITEMS.map((item) => (
                    <div key={item}>
                      <label htmlFor={`checklist_${item}`} className="block text-xs font-medium text-gray-600 mb-1">
                        {RELEASE_CHECKLIST_LABELS[item]}
                      </label>
                      <select
                        id={`checklist_${item}`}
                        name={`checklist_${item}`}
                        defaultValue={existingChecklist[item] || "pending"}
                        className={inputClass}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="not_approved">Not Approved</option>
                        <option value="na">N/A</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plannedBudget" className={labelClass}>
                    Planned Budget
                  </label>
                  <input
                    id="plannedBudget"
                    name="plannedBudget"
                    defaultValue={project?.budget || ""}
                    className={inputClass}
                    placeholder="e.g., $50,000"
                  />
                </div>
                <div>
                  <label htmlFor="actualBudget" className={labelClass}>
                    Actual Budget
                  </label>
                  <input
                    id="actualBudget"
                    name="actualBudget"
                    defaultValue={project?.actualBudget || ""}
                    className={inputClass}
                    placeholder="e.g., $48,000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plannedSchedule" className={labelClass}>
                    Planned Schedule
                  </label>
                  <input
                    id="plannedSchedule"
                    name="plannedSchedule"
                    defaultValue={project?.plannedSchedule || ""}
                    className={inputClass}
                    placeholder="e.g., Q1 2026 - Q3 2026"
                  />
                </div>
                <div>
                  <label htmlFor="actualSchedule" className={labelClass}>
                    Actual Schedule
                  </label>
                  <input
                    id="actualSchedule"
                    name="actualSchedule"
                    defaultValue={project?.actualSchedule || ""}
                    className={inputClass}
                    placeholder="e.g., Q1 2026 - Q4 2026"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="isComplete" className={labelClass}>
                    Is Complete?
                  </label>
                  <select
                    id="isComplete"
                    name="isComplete"
                    value={isComplete}
                    onChange={(e) => setIsComplete(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Select --</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="contingent">Contingent</option>
                  </select>
                </div>
                {isComplete === "contingent" && (
                  <div>
                    <label htmlFor="contingentDetails" className={labelClass}>
                      Contingent Details
                    </label>
                    <textarea
                      id="contingentDetails"
                      name="contingentDetails"
                      rows={2}
                      defaultValue={project?.contingentDetails || ""}
                      className={inputClass}
                      placeholder="Describe the contingency..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
            ? "Save Changes"
            : "Create Project"}
        </button>
        <Link
          href={isEdit ? `/projects/${project.id}` : "/projects"}
          className="text-gray-600 hover:text-gray-800 text-sm"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
