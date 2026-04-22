import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { FolderKanban, ArrowLeft } from "lucide-react";

export default async function ProjectLogPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  // Default shows everything, reverse-chronological by completion date then
  // creation date. "completed" filter narrows to just finished projects.
  const where = filter === "completed" ? { status: "completed" } : {};

  const projects = await prisma.project.findMany({
    where,
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      projectLead: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
    },
  });

  const counts = {
    all: await prisma.project.count(),
    completed: await prisma.project.count({ where: { status: "completed" } }),
    in_progress: await prisma.project.count({ where: { status: "in_progress" } }),
  };

  function daysBetween(start: Date, end: Date): number {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
    }`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-1"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Project Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every project, sorted by most recently completed or created.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link href="/projects/log" className={tabClass(!filter)}>
          All ({counts.all})
        </Link>
        <Link href="/projects/log?filter=completed" className={tabClass(filter === "completed")}>
          Completed ({counts.completed})
        </Link>
        <span className="text-xs text-gray-500">
          • {counts.in_progress} in progress
        </span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FolderKanban size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No projects to show.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {projects.map((p) => {
              const duration =
                p.completedAt
                  ? daysBetween(p.createdAt, p.completedAt)
                  : daysBetween(p.createdAt, new Date());
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-blue-600 truncate">{p.title}</span>
                        <StatusBadge status={p.status} />
                        <StatusBadge status={p.priority} />
                        {p.parent && (
                          <span className="text-xs text-gray-500">
                            ↳ sub-project of{" "}
                            <span className="text-gray-700">{p.parent.title}</span>
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{p.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Lead: {p.projectLead?.name || p.createdBy.name}
                        {p.budget ? ` · ${p.budget}` : ""}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-xs text-gray-500 sm:whitespace-nowrap shrink-0">
                      {p.completedAt ? (
                        <>
                          <p className="font-medium text-gray-700">
                            Completed {new Date(p.completedAt).toLocaleDateString()}
                          </p>
                          <p>{duration} day{duration === 1 ? "" : "s"} total</p>
                        </>
                      ) : (
                        <>
                          <p>Started {new Date(p.createdAt).toLocaleDateString()}</p>
                          <p>{duration} day{duration === 1 ? "" : "s"} open</p>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
