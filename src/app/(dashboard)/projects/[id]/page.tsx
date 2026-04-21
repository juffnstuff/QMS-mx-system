import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
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
        {session?.user.role === "admin" && (
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${id}/edit`}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Pencil size={14} />
              Edit
            </Link>
            <DeleteRecordButton
              recordId={id}
              recordType="projects"
              recordLabel={project.title}
              redirectTo="/projects"
            />
          </div>
        )}
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
        </dl>
      </div>

      <div className="mb-6">
        <AttachmentsSection
          recordType="project"
          recordId={id}
          currentUserId={session?.user.id ?? ""}
          isAdmin={session?.user.role === "admin"}
        />
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
