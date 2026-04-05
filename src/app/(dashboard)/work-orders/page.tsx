import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
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

  const workOrders = await prisma.workOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { equipment: true, assignedTo: true, createdBy: true },
    take: 50,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
        <Link
          href="/work-orders/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Work Order
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            name="priority"
            defaultValue={params.priority || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="submit"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {workOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No work orders found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {workOrders.map((order) => (
              <Link
                key={order.id}
                href={`/work-orders/${order.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{order.title}</p>
                    <p className="text-sm text-gray-500">
                      {order.equipment.name} •{" "}
                      {order.assignedTo ? `Assigned to ${order.assignedTo.name}` : "Unassigned"}
                    </p>
                    {order.dueDate && (
                      <p className={`text-xs mt-0.5 ${new Date(order.dueDate) < new Date() && order.status !== "completed" ? "text-red-500" : "text-gray-400"}`}>
                        Due: {new Date(order.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={order.priority} />
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
