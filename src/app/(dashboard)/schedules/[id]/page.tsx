import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { ScheduleCompleteButton } from "@/components/schedule-complete-button";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { NotesSection } from "@/components/notes/notes-section";
import { StatusHistory } from "@/components/status-history";
import Link from "next/link";
import { Pencil, Calendar, AlertTriangle } from "lucide-react";

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: {
      equipment: true,
      assignedTo: true,
      secondaryAssignedTo: true,
      sourceWorkOrder: true,
    },
  });

  if (!schedule) notFound();

  const isOverdue = new Date(schedule.nextDue) < new Date();
  const daysUntil = Math.ceil(
    (new Date(schedule.nextDue).getTime() - new Date().getTime()) / 86400000
  );

  // Get recent maintenance logs for this equipment that match this schedule title
  const recentLogs = await prisma.maintenanceLog.findMany({
    where: {
      equipmentId: schedule.equipmentId,
      description: { contains: schedule.title },
    },
    orderBy: { performedAt: "desc" },
    take: 10,
    include: { user: true },
  });

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Schedules", href: "/schedules" },
        { label: schedule.title },
      ]} />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{schedule.title}</h1>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                <AlertTriangle size={12} />
                Overdue
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            <Link href={`/equipment/${schedule.equipmentId}`} className="text-blue-600 hover:text-blue-800">
              {schedule.equipment.name}
            </Link>
            {" "}&bull; {frequencyLabels[schedule.frequency] || schedule.frequency}
          </p>
        </div>
        {session?.user.role === "admin" && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/schedules/${id}/edit`}
              className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <Pencil size={14} />
              Edit
            </Link>
            <DeleteRecordButton
              recordId={id}
              recordType="schedules"
              recordLabel={schedule.title}
              redirectTo="/schedules"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {schedule.checklistTemplateId ? (
            /* Checklist-driven schedule — point the user at /checklists */
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-blue-900">
                <p className="font-medium">This schedule runs as a PM checklist.</p>
                <p className="text-blue-700">
                  Completing the daily, weekly, or monthly PM checklist updates this schedule automatically.
                </p>
              </div>
              <Link
                href="/checklists"
                className="inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 shrink-0"
              >
                Open checklists →
              </Link>
            </div>
          ) : (
            /* Standalone / vendor schedule — let the user mark complete (+ attach cert) */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Complete This Maintenance</h2>
              <ScheduleCompleteButton
                scheduleId={schedule.id}
                scheduleTitle={schedule.title}
              />
              <p className="text-xs text-gray-400 mt-3">
                Logs a maintenance entry (with an optional vendor cert attachment) and advances the next due date.
              </p>
            </div>
          )}

          {/* Description */}
          {schedule.description && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{schedule.description}</p>
            </div>
          )}

          <NotesSection
            recordType="maintenance_schedule"
            recordId={id}
            currentUserId={session?.user.id ?? ""}
            isAdmin={session?.user.role === "admin"}
          />

          <AttachmentsSection
            recordType="maintenance_schedule"
            recordId={id}
            currentUserId={session?.user.id ?? ""}
            isAdmin={session?.user.role === "admin"}
          />

          <StatusHistory entityType="maintenanceSchedule" entityId={id} />

          {/* Completion History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Completion History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {recentLogs.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No completions logged yet.</p>
              ) : (
                recentLogs.map((log) => (
                  <Link
                    key={log.id}
                    href={`/maintenance/${log.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-900">{log.description}</p>
                    {log.partsUsed && (
                      <p className="text-xs text-gray-500 mt-0.5">Parts: {log.partsUsed}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      <span className="text-blue-500">{log.user.name}</span>
                      {" "}&bull; {new Date(log.performedAt).toLocaleDateString()}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500 uppercase">Equipment</dt>
                <dd>
                  <Link href={`/equipment/${schedule.equipmentId}`} className="text-blue-600 hover:text-blue-800 text-sm">
                    {schedule.equipment.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Frequency</dt>
                <dd className="text-sm text-gray-900 capitalize">{schedule.frequency}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Next Due</dt>
                <dd className={`text-sm font-medium ${isOverdue ? "text-red-600" : daysUntil <= 3 ? "text-orange-600" : "text-gray-900"}`}>
                  {new Date(schedule.nextDue).toLocaleDateString()}
                  {isOverdue
                    ? ` (${Math.abs(daysUntil)} days overdue)`
                    : daysUntil === 0
                    ? " (today)"
                    : ` (in ${daysUntil} days)`}
                </dd>
              </div>
              {schedule.lastDone && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Last Completed</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(schedule.lastDone).toLocaleDateString()}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 uppercase">Assigned To</dt>
                <dd className="text-sm">
                  {schedule.assignedTo ? (
                    <Link href={`/users?highlight=${schedule.assignedTo.id}`} className="text-blue-600 hover:text-blue-800">
                      {schedule.assignedTo.name}
                    </Link>
                  ) : <span className="text-gray-400">Unassigned</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Secondary Assignee</dt>
                <dd className="text-sm">
                  {schedule.secondaryAssignedTo ? (
                    <Link href={`/users?highlight=${schedule.secondaryAssignedTo.id}`} className="text-blue-600 hover:text-blue-800">
                      {schedule.secondaryAssignedTo.name}
                    </Link>
                  ) : <span className="text-gray-400">None</span>}
                </dd>
              </div>
              {schedule.sourceWorkOrder && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Source Work Order</dt>
                  <dd>
                    <Link href={`/work-orders/${schedule.sourceWorkOrder.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                      {schedule.sourceWorkOrder.title}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 uppercase">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(schedule.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
