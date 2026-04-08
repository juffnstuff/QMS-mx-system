import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      maintenanceLogs: {
        take: 10,
        orderBy: { performedAt: "desc" },
        include: { user: true },
      },
      schedules: {
        orderBy: { nextDue: "asc" },
      },
      workOrders: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { assignedTo: true },
      },
    },
  });

  if (!equipment) notFound();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/equipment"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {equipment.name}
            </h1>
            <StatusBadge status={equipment.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {equipment.type} • {equipment.location}
          </p>
        </div>
        {session?.user.role === "admin" && (
          <Link
            href={`/equipment/${id}/edit`}
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
            <dt className="text-sm text-gray-500">Serial Number</dt>
            <dd className="font-mono text-gray-900">{equipment.serialNumber}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Type</dt>
            <dd className="text-gray-900">{equipment.type}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Location</dt>
            <dd className="text-gray-900">{equipment.location}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd><StatusBadge status={equipment.status} /></dd>
          </div>
          {equipment.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Notes</dt>
              <dd className="text-gray-900">{equipment.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Maintenance Schedules */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Maintenance Schedules</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {equipment.schedules.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No maintenance schedules configured.</p>
          ) : (
            equipment.schedules.map((schedule) => {
              const isOverdue = new Date(schedule.nextDue) < new Date();
              return (
                <div key={schedule.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{schedule.title}</p>
                    <p className="text-sm text-gray-500 capitalize">{schedule.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-600"}`}>
                      {isOverdue ? "OVERDUE" : "Due"}: {new Date(schedule.nextDue).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent Work Orders</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {equipment.workOrders.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No work orders for this equipment.</p>
          ) : (
            <>
              {equipment.workOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/work-orders/${order.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-600 hover:text-blue-800">{order.title}</p>
                      <p className="text-sm text-gray-500">
                        {order.assignedTo ? order.assignedTo.name : "Unassigned"} •{" "}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={order.priority} />
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </Link>
              ))}
              <div className="p-3 border-t border-gray-100 text-center">
                <Link
                  href={`/work-orders?equipmentId=${equipment.id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View all work orders for this equipment
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Maintenance Log */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Maintenance History</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {equipment.maintenanceLogs.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No maintenance history recorded.</p>
          ) : (
            equipment.maintenanceLogs.map((log) => (
              <div key={log.id} className="p-4">
                <p className="text-gray-900">{log.description}</p>
                {log.partsUsed && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    Parts: {log.partsUsed}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {log.user.name} • {new Date(log.performedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
