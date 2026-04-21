import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Plus, Search, FolderKanban, History } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; search?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  if (params.priority && params.priority !== "all") {
    where.priority = params.priority;
  }
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      projectLead: { select: { id: true, name: true } },
      parent: { select: { id: true, title: true } },
      _count: { select: { children: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group sub-projects directly under their parent in the rendered list,
  // preserving the createdAt-desc order within each group. Sub-projects whose
  // parent isn't in the visible set bubble up to the top level so they don't
  // disappear when the user filters/searches.
  const visibleProjectIds = new Set(projects.map((p) => p.id));
  const childrenByParent = new Map<string, typeof projects>();
  const topLevelProjects: typeof projects = [];
  for (const p of projects) {
    if (p.parentProjectId && visibleProjectIds.has(p.parentProjectId)) {
      const list = childrenByParent.get(p.parentProjectId) ?? [];
      list.push(p);
      childrenByParent.set(p.parentProjectId, list);
    } else {
      topLevelProjects.push(p);
    }
  }
  const grouped: Array<(typeof projects)[number] & { _depth: number }> = [];
  for (const top of topLevelProjects) {
    grouped.push({ ...top, _depth: 0 });
    for (const child of childrenByParent.get(top.id) ?? []) {
      grouped.push({ ...child, _depth: 1 });
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/projects/log"
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <History size={16} />
            Project Log
          </Link>
          {session?.user && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              New Project
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              name="search"
              type="text"
              placeholder="Search projects..."
              defaultValue={params.search || ""}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          <select
            name="priority"
            defaultValue={params.priority || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button
            type="submit"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project Lead
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map((project) => (
                <tr
                  key={project.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    project._depth > 0 ? "bg-gray-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center"
                      style={{ paddingLeft: project._depth * 24 }}
                    >
                      {project._depth > 0 && (
                        <span className="text-gray-400 mr-2 select-none">↳</span>
                      )}
                      <Link
                        href={`/projects/${project.id}`}
                        className={`hover:text-blue-800 ${
                          project._depth > 0
                            ? "text-gray-700"
                            : "text-blue-600 font-medium"
                        }`}
                      >
                        {project.title}
                      </Link>
                      {project._depth === 0 && project._count.children > 0 && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                          {project._count.children} sub-project
                          {project._count.children === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.priority} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {project.budget || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {project.dueDate
                      ? new Date(project.dueDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {project.projectLead?.name || project.createdBy.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {grouped.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={`block p-4 hover:bg-gray-50 ${
                project._depth > 0 ? "bg-gray-50/50" : ""
              }`}
              style={{ paddingLeft: 16 + project._depth * 20 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {project._depth > 0 && (
                      <span className="text-gray-400 mr-1">↳</span>
                    )}
                    {project.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {project.budget || "No budget"} • {project.createdBy.name}
                  </p>
                  {project.dueDate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Due: {new Date(project.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <StatusBadge status={project.status} />
                  <StatusBadge status={project.priority} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {grouped.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <FolderKanban size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No projects found.</p>
            {session?.user.role === "admin" && (
              <Link
                href="/projects/new"
                className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
              >
                Create your first project
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
