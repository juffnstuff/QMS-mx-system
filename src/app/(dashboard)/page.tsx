import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { AlertTriangle, CheckCircle, Clock, Wrench, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    totalEquipment,
    operationalCount,
    needsServiceCount,
    downCount,
    openWorkOrders,
    overdueSchedules,
    recentLogs,
    criticalOrders,
    pendingSuggestions,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: "operational" } }),
    prisma.equipment.count({ where: { status: "needs_service" } }),
    prisma.equipment.count({ where: { status: "down" } }),
    prisma.workOrder.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.maintenanceSchedule.count({
      where: { nextDue: { lt: new Date() } },
    }),
    prisma.maintenanceLog.findMany({
      take: 5,
      orderBy: { performedAt: "desc" },
      include: { equipment: true, user: true },
    }),
    prisma.workOrder.findMany({
      where: { status: { in: ["open", "in_progress"] }, priority: { in: ["high", "critical"] } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { equipment: true, assignedTo: true },
    }),
    prisma.aISuggestion.count({ where: { status: "pending" } }).catch(() => 0),
  ]);

  const stats = [
    {
      label: "Total Equipment",
      value: totalEquipment,
      icon: Wrench,
      color: "bg-blue-500",
    },
    {
      label: "Operational",
      value: operationalCount,
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      label: "Needs Service",
      value: needsServiceCount + downCount,
      icon: AlertTriangle,
      color: "bg-yellow-500",
    },
    {
      label: "Open Work Orders",
      value: openWorkOrders,
      icon: Clock,
      color: "bg-purple-500",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow-sm p-5 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue Alert */}
      {overdueSchedules > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-600" />
            <p className="text-red-800 font-medium">
              {overdueSchedules} overdue maintenance schedule{overdueSchedules !== 1 ? "s" : ""} need attention!
            </p>
            <Link href="/schedules" className="ml-auto text-red-600 hover:text-red-800 text-sm font-medium underline">
              View Schedules
            </Link>
          </div>
        </div>
      )}

      {/* AI Suggestions Alert */}
      {pendingSuggestions > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-purple-600" />
            <p className="text-purple-800 font-medium">
              {pendingSuggestions} AI suggestion{pendingSuggestions !== 1 ? "s" : ""} awaiting review
            </p>
            <Link href="/settings/m365/suggestions" className="ml-auto text-purple-600 hover:text-purple-800 text-sm font-medium underline">
              Review
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Priority Work Orders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              High Priority Work Orders
            </h2>
            <Link
              href="/work-orders"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {criticalOrders.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">
                No high priority work orders. All clear!
              </p>
            ) : (
              criticalOrders.map((order) => (
                <div key={order.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{order.title}</p>
                      <p className="text-sm text-gray-500">
                        {order.equipment.name}
                        {order.assignedTo
                          ? ` • Assigned to ${order.assignedTo.name}`
                          : " • Unassigned"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={order.priority} />
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Maintenance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Recent Maintenance
            </h2>
            <Link
              href="/maintenance"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentLogs.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm">
                No maintenance events logged yet.
              </p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-4">
                  <p className="font-medium text-gray-900">
                    {log.equipment.name}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {log.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {log.user.name} •{" "}
                    {new Date(log.performedAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
