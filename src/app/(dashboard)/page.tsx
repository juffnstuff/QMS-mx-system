import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AlertTriangle, CheckCircle, Clock, Wrench, Sparkles, FolderKanban } from "lucide-react";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban-board";
import type { KanbanCardData, EntityType } from "@/components/kanban-card";

type ColumnId = "backlog" | "in_progress" | "needs_parts" | "scheduled" | "done";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";

  // Operators only see board items where they are primary or secondary on the
  // record (creator counts for projects too, since projects don't always have
  // an assignee set). Admins see everything.
  const mineOr = (fields: string[]) =>
    isAdmin || !userId
      ? {}
      : { OR: fields.map((f) => ({ [f]: userId })) };

  const [
    totalEquipment,
    operationalCount,
    needsServiceCount,
    downCount,
    openWorkOrders,
    overdueSchedules,
    pendingSuggestions,
    activeProjects,
    // Board data
    workOrders,
    maintenanceSchedules,
    ncrs,
    capas,
    projects,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "operational" } }),
    prisma.equipment.count({ where: { status: "needs_service" } }),
    prisma.equipment.count({ where: { status: "down" } }),
    prisma.workOrder.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.maintenanceSchedule.count({
      where: { nextDue: { lt: new Date() } },
    }),
    prisma.aISuggestion.count({ where: { status: "pending" } }).catch(() => 0),
    prisma.project.count({ where: { status: { in: ["planning", "in_progress"] } } }),
    // Fetch active items for the Kanban board. Operators only see items
    // where they are a primary or secondary assignee.
    prisma.workOrder.findMany({
      where: {
        status: { in: ["open", "in_progress"] },
        ...mineOr(["assignedToId", "secondaryAssignedToId"]),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { equipment: true, assignedTo: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        nextDue: { lt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
        ...mineOr(["assignedToId", "secondaryAssignedToId"]),
      },
      orderBy: { nextDue: "asc" },
      take: 50,
      include: { equipment: true, assignedTo: true },
    }),
    prisma.nonConformance.findMany({
      where: {
        status: { in: ["open", "under_review", "dispositioned"] },
        ...mineOr(["assignedInvestigatorId", "secondaryInvestigatorId"]),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { submittedBy: true, assignedInvestigator: true },
    }),
    prisma.cAPA.findMany({
      where: {
        status: { in: ["open", "in_progress", "pending_verification"] },
        ...mineOr(["assignedToId", "secondaryAssignedToId"]),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { originator: true, assignedTo: true },
    }),
    prisma.project.findMany({
      where: {
        status: { in: ["planning", "in_progress", "on_hold"] },
        ...mineOr(["projectLeadId", "secondaryLeadId"]),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdBy: true, projectLead: true },
    }),
  ]);

  // Build card data for the Kanban board
  const cards: KanbanCardData[] = [];
  const columnMap: Record<ColumnId, string[]> = {
    backlog: [],
    in_progress: [],
    needs_parts: [],
    scheduled: [],
    done: [],
  };

  // Work Orders
  for (const wo of workOrders) {
    const key = `workOrder::${wo.id}`;
    const col = (wo.boardStatus || "backlog") as ColumnId;
    cards.push({
      id: wo.id,
      entityType: "workOrder" as EntityType,
      title: wo.title,
      subtitle: wo.equipment.name,
      assigneeName: wo.assignedTo?.name || null,
      dueDate: wo.dueDate?.toISOString() || null,
      href: `/work-orders/${wo.id}`,
      priority: wo.priority,
    });
    if (columnMap[col]) columnMap[col].push(key);
    else columnMap.backlog.push(key);
  }

  // Maintenance Schedules
  for (const ms of maintenanceSchedules) {
    const key = `maintenanceSchedule::${ms.id}`;
    const col = (ms.boardStatus || "backlog") as ColumnId;
    cards.push({
      id: ms.id,
      entityType: "maintenanceSchedule" as EntityType,
      title: ms.title,
      subtitle: ms.equipment.name,
      assigneeName: ms.assignedTo?.name || null,
      dueDate: ms.nextDue?.toISOString() || null,
      href: `/schedules/${ms.id}`,
      priority: null,
    });
    if (columnMap[col]) columnMap[col].push(key);
    else columnMap.backlog.push(key);
  }

  // NCRs
  for (const ncr of ncrs) {
    const key = `nonConformance::${ncr.id}`;
    const col = (ncr.boardStatus || "backlog") as ColumnId;
    cards.push({
      id: ncr.id,
      entityType: "nonConformance" as EntityType,
      title: `${ncr.ncrNumber} — ${ncr.nonConformanceDescription.slice(0, 60)}`,
      subtitle: ncr.partNumber || ncr.ncrType,
      assigneeName: ncr.assignedInvestigator?.name || ncr.submittedBy?.name || null,
      dueDate: null,
      href: `/ncrs/${ncr.id}`,
      priority: null,
    });
    if (columnMap[col]) columnMap[col].push(key);
    else columnMap.backlog.push(key);
  }

  // CAPAs
  for (const capa of capas) {
    const key = `capa::${capa.id}`;
    const col = (capa.boardStatus || "backlog") as ColumnId;
    cards.push({
      id: capa.id,
      entityType: "capa" as EntityType,
      title: `${capa.capaNumber} — ${capa.nonconformanceDescription.slice(0, 60)}`,
      subtitle: capa.department || capa.source,
      assigneeName: capa.assignedTo?.name || capa.originator?.name || null,
      dueDate: capa.targetCloseDate?.toISOString() || null,
      href: `/capas/${capa.id}`,
      priority: capa.severityLevel,
    });
    if (columnMap[col]) columnMap[col].push(key);
    else columnMap.backlog.push(key);
  }

  // Projects
  for (const proj of projects) {
    const key = `project::${proj.id}`;
    const col = (proj.boardStatus || "backlog") as ColumnId;
    cards.push({
      id: proj.id,
      entityType: "project" as EntityType,
      title: proj.title,
      subtitle: proj.phase ? `Phase: ${proj.phase}` : "Project",
      assigneeName: proj.projectLead?.name || proj.createdBy?.name || null,
      dueDate: proj.dueDate?.toISOString() || null,
      href: `/projects/${proj.id}`,
      priority: proj.priority,
    });
    if (columnMap[col]) columnMap[col].push(key);
    else columnMap.backlog.push(key);
  }

  const stats = [
    {
      label: "Total Equipment",
      value: totalEquipment,
      icon: Wrench,
      color: "bg-blue-500",
      href: "/equipment",
    },
    {
      label: "Operational",
      value: operationalCount,
      icon: CheckCircle,
      color: "bg-green-500",
      href: "/equipment?status=operational",
    },
    {
      label: "Needs Service",
      value: needsServiceCount + downCount,
      icon: AlertTriangle,
      color: "bg-yellow-500",
      href: "/equipment?status=needs_service",
    },
    {
      label: "Open Work Orders",
      value: openWorkOrders,
      icon: Clock,
      color: "bg-purple-500",
      href: "/work-orders?status=open",
    },
    {
      label: "Active Projects",
      value: activeProjects,
      icon: FolderKanban,
      color: "bg-indigo-500",
      href: "/projects",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        QMS Tracker — Work Board
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-2.5 rounded-lg`}>
                  <Icon size={20} className="text-white" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Alert Banners */}
      <div className="space-y-3 mb-6">
        {overdueSchedules > 0 && (
          <Link
            href="/schedules?filter=overdue"
            className="block bg-red-50 border border-red-200 rounded-lg p-3 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <p className="text-red-800 font-medium text-sm">
                {overdueSchedules} overdue maintenance schedule{overdueSchedules !== 1 ? "s" : ""} need attention
              </p>
              <span className="ml-auto text-red-600 text-xs font-medium">
                View Schedules →
              </span>
            </div>
          </Link>
        )}

        {pendingSuggestions > 0 && (
          <Link
            href="/settings/m365/suggestions"
            className="block bg-purple-50 border border-purple-200 rounded-lg p-3 hover:bg-purple-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600 shrink-0" />
              <p className="text-purple-800 font-medium text-sm">
                {pendingSuggestions} AI suggestion{pendingSuggestions !== 1 ? "s" : ""} awaiting review
              </p>
              <span className="ml-auto text-purple-600 text-xs font-medium">
                Review →
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* Kanban Board */}
      <KanbanBoard initialCards={cards} initialColumns={columnMap} />
    </div>
  );
}
