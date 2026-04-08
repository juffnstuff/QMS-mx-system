import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const project = await prisma.project.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  if (!project) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/projects"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Created by {project.createdBy.name} • {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        {session?.user.role === "admin" && (
          <Link
            href={`/projects/${id}/edit`}
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Pencil size={14} />
            Edit
          </Link>
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
        </dl>
      </div>
    </div>
  );
}
