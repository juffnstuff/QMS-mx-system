import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { WorkOrderStatusUpdate } from "@/components/work-order-status-update";
import { MakeRecurringButton } from "@/components/make-recurring-button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import Link from "next/link";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const order = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      equipment: true,
      assignedTo: true,
      secondaryAssignedTo: true,
      createdBy: true,
      createdSchedules: true,
    },
  });

  if (!order) notFound();

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Work Orders", href: "/work-orders" },
        { label: order.title },
      ]} />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            <Link href={`/equipment/${order.equipmentId}`} className="text-blue-600 hover:text-blue-800">
              {order.equipment.name}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.priority} />
          <StatusBadge status={order.status} />
          {session?.user.role === "admin" && (
            <DeleteRecordButton
              recordId={id}
              recordType="work-orders"
              recordLabel={order.title}
              redirectTo="/work-orders"
              compact
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{order.description}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Update Status</h2>
            <WorkOrderStatusUpdate
              workOrderId={order.id}
              currentStatus={order.status}
              isAdmin={session?.user.role === "admin"}
            />
            {order.status === "completed" && (
              <p className="text-sm text-green-600 mt-2">
                Completed on {order.completedAt ? new Date(order.completedAt).toLocaleDateString() : "N/A"}
              </p>
            )}
          </div>

          {/* Recurring Maintenance */}
          {session?.user.role === "admin" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Recurring Maintenance</h2>
              {order.createdSchedules.length > 0 ? (
                <div className="space-y-2">
                  {order.createdSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{schedule.title}</span>
                      <span className="text-gray-500 capitalize">{schedule.frequency}</span>
                    </div>
                  ))}
                  <Link href="/schedules" className="text-blue-600 hover:underline text-sm">
                    View schedules &rarr;
                  </Link>
                </div>
              ) : (
                <MakeRecurringButton
                  workOrderId={order.id}
                  defaultTitle={order.title}
                  defaultDescription={order.description}
                  equipmentId={order.equipmentId}
                  equipmentName={order.equipment.name}
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500 uppercase">Equipment</dt>
                <dd>
                  <Link href={`/equipment/${order.equipmentId}`} className="text-blue-600 hover:text-blue-800 text-sm">
                    {order.equipment.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Priority</dt>
                <dd><StatusBadge status={order.priority} /></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Status</dt>
                <dd><StatusBadge status={order.status} /></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Assigned To</dt>
                <dd className="text-sm">
                  {order.assignedTo ? (
                    <Link href={`/users?highlight=${order.assignedTo.id}`} className="text-blue-600 hover:text-blue-800">{order.assignedTo.name}</Link>
                  ) : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Secondary Assignee</dt>
                <dd className="text-sm">
                  {order.secondaryAssignedTo ? (
                    <Link href={`/users?highlight=${order.secondaryAssignedTo.id}`} className="text-blue-600 hover:text-blue-800">{order.secondaryAssignedTo.name}</Link>
                  ) : <span className="text-gray-400">None</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Created By</dt>
                <dd className="text-sm">
                  <Link href={`/users?highlight=${order.createdBy.id}`} className="text-blue-600 hover:text-blue-800">{order.createdBy.name}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </dd>
              </div>
              {order.dueDate && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Due Date</dt>
                  <dd className={`text-sm ${new Date(order.dueDate) < new Date() && order.status !== "completed" ? "text-red-600 font-medium" : "text-gray-900"}`}>
                    {new Date(order.dueDate).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
