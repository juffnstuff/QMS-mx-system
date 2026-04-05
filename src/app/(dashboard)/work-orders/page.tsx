import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { ClipboardList } from "lucide-react";

export default async function WorkOrdersPage() {
  const workOrders = await prisma.workOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { equipment: true, assignedTo: true, createdBy: true },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Work Orders</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {workOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No work orders created yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {workOrders.map((order) => (
              <div key={order.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{order.title}</p>
                    <p className="text-sm text-gray-500">
                      {order.equipment.name} •{" "}
                      {order.assignedTo ? `Assigned to ${order.assignedTo.name}` : "Unassigned"} •{" "}
                      Created by {order.createdBy.name}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">{order.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={order.priority} />
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
