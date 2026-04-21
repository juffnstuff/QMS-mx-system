import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { StatusHistory } from "@/components/status-history";
import Link from "next/link";
import { Pencil } from "lucide-react";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      projectLead: { select: { id: true, name: true } },
      secondaryLead: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true, status: true } },
      children: {
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Projects", href: "/projects" },
        { label: project.title },
      ]} />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Created by <Link href={`/users?highlight=${project.createdBy.id}`} className="text-blue-600 hover:text-blue-800">{project.createdBy.name}</Link> • {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${id}/edit`}
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Pencil size={14} />
            Edit
          </Link>
          {session?.user.role === "admin" && (
            <DeleteRecordButton
              recordId={id}
              recordType="projects"
              recordLabel={project.title}
              redirectTo="/projects"
            />
          )}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd><StatusBadge status={project.status} /></dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Priority</dt>
            <dd><StatusBadge status={project.priority} /></dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Project Lead</dt>
            <dd className="text-gray-900">
              {project.projectLead ? (
                <Link href={`/users?highlight=${project.projectLead.id}`} className="text-blue-600 hover:text-blue-800">{project.projectLead.name}</Link>
              ) : <span className="text-gray-400">Unassigned</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Secondary Lead</dt>
            <dd className="text-gray-900">
              {project.secondaryLead ? (
                <Link href={`/users?highlight=${project.secondaryLead.id}`} className="text-blue-600 hover:text-blue-800">{project.secondaryLead.name}</Link>
              ) : <span className="text-gray-400">None</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Budget</dt>
            <dd className="text-gray-900">{project.budget || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Due Date</dt>
            <dd className="text-gray-900">
              {project.dueDate
                ? new Date(project.dueDate).toLocaleDateString()
                : "Not set"}
            </dd>
          </div>
          {project.completedAt && (
            <div>
              <dt className="text-sm text-gray-500">Completed</dt>
              <dd className="text-gray-900">
                {new Date(project.completedAt).toLocaleDateString()}
              </dd>
            </div>
          )}
          {project.description && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Description</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.description}</dd>
            </div>
          )}
          {project.keywords && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Keywords / Facility Area</dt>
              <dd className="text-gray-900">{project.keywords}</dd>
            </div>
          )}
          {project.parent && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Parent Project</dt>
              <dd>
                <Link
                  href={`/projects/${project.parent.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 transition-colors"
                >
                  {project.parent.title}
                  <StatusBadge status={project.parent.status} />
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Phase</dt>
            <dd className="text-gray-900 capitalize">{(project.phase || "concept").replace(/_/g, " ")}</dd>
          </div>
        </dl>
      </div>

      {(project.projectJustification ||
        project.designObjectives ||
        project.designRequirements ||
        project.potentialVendors) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Phase 1 — Project Concept</h2>
          {project.projectJustification && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Project Justification</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.projectJustification}</dd>
            </div>
          )}
          {project.designObjectives && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Design Objectives</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.designObjectives}</dd>
            </div>
          )}
          {project.designRequirements && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Design Requirements</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.designRequirements}</dd>
            </div>
          )}
          {project.potentialVendors && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Potential Vendors &amp; Contractors</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.potentialVendors}</dd>
            </div>
          )}
        </div>
      )}

      {(project.salesMarketingActions || project.engineeringActions) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Phase 2 — Design &amp; Development</h2>
          {project.salesMarketingActions && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Sales &amp; Marketing Actions</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.salesMarketingActions}</dd>
            </div>
          )}
          {project.engineeringActions && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Engineering Actions</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.engineeringActions}</dd>
            </div>
          )}
        </div>
      )}

      {(project.releaseChecklist ||
        project.actualBudget ||
        project.plannedSchedule ||
        project.actualSchedule ||
        project.isComplete) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Phase 3 — Production Release</h2>
          {project.releaseChecklist && (() => {
            let checklist: Record<string, string> = {};
            try {
              checklist = JSON.parse(project.releaseChecklist);
            } catch {
              return null;
            }
            const labels: Record<string, string> = {
              manufacturingDrawings: "Manufacturing Drawings",
              processSettings: "Process Settings",
              workInstructions: "Work Instructions",
              operatorTraining: "Operator Training",
              maintenanceTraining: "Maintenance Training",
              inProcessDocuments: "In Process Documents",
              productionControlDocuments: "Production Control Documents",
              criticalSpares: "Critical Spares",
            };
            const entries = Object.entries(checklist).filter(([, v]) => v && v !== "pending");
            if (entries.length === 0) return null;
            return (
              <div>
                <dt className="text-sm text-gray-500 mb-2">Release Checklist</dt>
                <dd className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm border border-gray-100 rounded px-2 py-1">
                      <span className="text-gray-700">{labels[key] || key}</span>
                      <span className="capitalize text-gray-500">{value.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </dd>
              </div>
            );
          })()}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {project.actualBudget && (
              <div>
                <dt className="text-sm text-gray-500">Actual Budget</dt>
                <dd className="text-gray-900">{project.actualBudget}</dd>
              </div>
            )}
            {project.plannedSchedule && (
              <div>
                <dt className="text-sm text-gray-500">Planned Schedule</dt>
                <dd className="text-gray-900">{project.plannedSchedule}</dd>
              </div>
            )}
            {project.actualSchedule && (
              <div>
                <dt className="text-sm text-gray-500">Actual Schedule</dt>
                <dd className="text-gray-900">{project.actualSchedule}</dd>
              </div>
            )}
            {project.isComplete && (
              <div>
                <dt className="text-sm text-gray-500">Is Complete?</dt>
                <dd className="text-gray-900 capitalize">{project.isComplete}</dd>
              </div>
            )}
          </dl>
          {project.isComplete === "contingent" && project.contingentDetails && (
            <div>
              <dt className="text-sm text-gray-500 mb-1">Contingent Details</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{project.contingentDetails}</dd>
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <AttachmentsSection
          recordType="project"
          recordId={id}
          currentUserId={session?.user.id ?? ""}
          isAdmin={session?.user.role === "admin"}
        />
      </div>

      <div className="mb-6">
        <StatusHistory entityType="project" entityId={id} />
      </div>

      {project.children.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Sub-Projects / Tasks ({project.children.length})
          </h2>
          <div className="divide-y divide-gray-200">
            {project.children.map((child) => (
              <Link
                key={child.id}
                href={`/projects/${child.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-medium">{child.title}</span>
                  <StatusBadge status={child.status} />
                  <StatusBadge status={child.priority} />
                </div>
                {child.dueDate && (
                  <span className="text-sm text-gray-500">
                    Due {new Date(child.dueDate).toLocaleDateString()}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
