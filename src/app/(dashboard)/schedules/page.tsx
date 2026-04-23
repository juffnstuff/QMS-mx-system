import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Plus } from "lucide-react";
import Link from "next/link";
import { SchedulesList } from "@/components/schedules-list";

export default async function SchedulesPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  const schedules = await prisma.maintenanceSchedule.findMany({
    orderBy: { nextDue: "asc" },
    include: {
      equipment: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Schedules</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            PM checklists run at <Link href="/checklists" className="text-blue-600 hover:text-blue-800">/checklists</Link>.
            This page is for vendor-managed and other recurring work.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/schedules/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Add Schedule
          </Link>
        )}
      </div>

      <SchedulesList
        schedules={schedules.map((s) => ({
          id: s.id,
          equipmentId: s.equipmentId,
          title: s.title,
          description: s.description,
          frequency: s.frequency,
          nextDue: s.nextDue.toISOString(),
          boardStatus: s.boardStatus,
          checklistTemplateId: s.checklistTemplateId,
          equipment: s.equipment,
          assignedTo: s.assignedTo,
        }))}
        isAdmin={isAdmin}
      />
    </div>
  );
}
