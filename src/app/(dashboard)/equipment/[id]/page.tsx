import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import Link from "next/link";
import { Pencil, ShieldAlert, Shield, ShieldCheck, Link2, ClipboardList, Plus } from "lucide-react";

const EQUIPMENT_CLASS_LABELS: Record<string, string> = {
  extruders: "Extruders & Production",
  presses: "Compression Molding",
  forklifts: "Forklifts & Material Handling",
  utilities: "Utilities & Support",
  other: "Other",
};

function CriticalityBadge({ criticality }: { criticality: string }) {
  const config: Record<string, { label: string; desc: string; bg: string; text: string; border: string; icon: typeof ShieldAlert }> = {
    A: { label: "Class A — Production Critical", desc: "Downtime directly stops production", bg: "bg-red-50", text: "text-red-800", border: "border-red-200", icon: ShieldAlert },
    B: { label: "Class B — Important", desc: "Affects efficiency; workarounds exist", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", icon: Shield },
    C: { label: "Class C — General", desc: "Low impact; easily replaceable", bg: "bg-green-50", text: "text-green-800", border: "border-green-200", icon: ShieldCheck },
  };
  const c = config[criticality] || config.C;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.bg} ${c.text} border ${c.border}`}>
      <Icon size={14} />
      {c.label}
    </span>
  );
}

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
      parent: true,
      children: { orderBy: { name: "asc" } },
      assignedTechnician: { select: { id: true, name: true } },
      secondaryTechnician: { select: { id: true, name: true } },
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

  // Fetch siblings in the same equipment group
  const groupMembers = equipment?.groupName
    ? await prisma.equipment.findMany({
        where: { groupName: equipment.groupName, NOT: { id } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, serialNumber: true, criticality: true },
      })
    : [];

  if (!equipment) notFound();

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Equipment", href: "/equipment" },
        { label: equipment.name },
      ]} />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {equipment.name}
            </h1>
            <CriticalityBadge criticality={equipment.criticality} />
            <StatusBadge status={equipment.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {equipment.type} • {equipment.location}
            {equipment.groupName && (
              <span className="ml-2 text-blue-600 font-medium">
                [{equipment.groupName}]
              </span>
            )}
          </p>
        </div>
        {session?.user.role === "admin" && (
          <div className="flex items-center gap-2">
            <Link
              href={`/equipment/${id}/edit`}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Pencil size={14} />
              Edit
            </Link>
            <DeleteRecordButton
              recordId={id}
              recordType="equipment"
              recordLabel={equipment.name}
              redirectTo="/equipment"
            />
          </div>
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
          <div>
            <dt className="text-sm text-gray-500">Criticality</dt>
            <dd className="mt-1"><CriticalityBadge criticality={equipment.criticality} /></dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Equipment Class</dt>
            <dd className="text-gray-900">
              {equipment.equipmentClass
                ? EQUIPMENT_CLASS_LABELS[equipment.equipmentClass] || equipment.equipmentClass
                : <span className="text-gray-400">Uncategorized</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Assigned Technician</dt>
            <dd className="text-gray-900">
              {equipment.assignedTechnician ? (
                <Link href={`/users?highlight=${equipment.assignedTechnician.id}`} className="text-blue-600 hover:text-blue-800">{equipment.assignedTechnician.name}</Link>
              ) : <span className="text-gray-400">Unassigned</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Secondary Technician</dt>
            <dd className="text-gray-900">
              {equipment.secondaryTechnician ? (
                <Link href={`/users?highlight=${equipment.secondaryTechnician.id}`} className="text-blue-600 hover:text-blue-800">{equipment.secondaryTechnician.name}</Link>
              ) : <span className="text-gray-400">Unassigned</span>}
            </dd>
          </div>
          {equipment.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Notes</dt>
              <dd className="text-gray-900">{equipment.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Equipment Relationships */}
      {(equipment.parent || equipment.children.length > 0 || groupMembers.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Link2 size={16} />
            Related Equipment
          </h2>

          {equipment.parent && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Parent Equipment</p>
              <Link
                href={`/equipment/${equipment.parent.id}`}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm bg-blue-50 px-3 py-1.5 rounded-md"
              >
                {equipment.parent.name}
                <span className="text-gray-400 font-mono text-xs">{equipment.parent.serialNumber}</span>
              </Link>
            </div>
          )}

          {equipment.children.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Sub-Components</p>
              <div className="flex flex-wrap gap-2">
                {equipment.children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/equipment/${child.id}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm bg-blue-50 px-3 py-1.5 rounded-md"
                  >
                    {child.name}
                    <span className="text-gray-400 font-mono text-xs">{child.serialNumber}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {groupMembers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Equipment Group: <span className="text-blue-600 normal-case">{equipment.groupName}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {groupMembers.map((member) => (
                  <Link
                    key={member.id}
                    href={`/equipment/${member.id}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200"
                  >
                    {member.name}
                    <span className="text-gray-400 font-mono text-xs">{member.serialNumber}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <Link
                  key={schedule.id}
                  href={`/schedules/${schedule.id}`}
                  className="block p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-blue-600 hover:text-blue-800">{schedule.title}</p>
                    <p className="text-sm text-gray-500 capitalize">{schedule.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-600"}`}>
                      {isOverdue ? "OVERDUE" : "Due"}: {new Date(schedule.nextDue).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
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
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Maintenance History</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/equipment/${id}/maintenance-log`}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ClipboardList size={14} />
              View full log
            </Link>
            <Link
              href={`/maintenance/new?equipmentId=${id}`}
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={14} />
              Log Maintenance
            </Link>
          </div>
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
                  <Link href={`/users?highlight=${log.user.id}`} className="text-blue-500 hover:text-blue-700">{log.user.name}</Link> • {new Date(log.performedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
