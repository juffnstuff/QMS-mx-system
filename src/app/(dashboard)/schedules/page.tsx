import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { ScheduleRowActions } from "@/components/schedule-row-actions";

export default async function SchedulesPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";

  const schedules = await prisma.maintenanceSchedule.findMany({
    orderBy: { nextDue: "asc" },
    include: { equipment: true, assignedTo: true },
  });

  const now = new Date();
  const overdueSchedules = schedules.filter((s) => new Date(s.nextDue) < now);
  const upcomingSchedules = schedules.filter((s) => new Date(s.nextDue) >= now);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Schedules</h1>
        {session?.user.role === "admin" && (
          <Link
            href="/schedules/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Add Schedule
          </Link>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No maintenance schedules configured yet.</p>
          {session?.user.role === "admin" && (
            <Link href="/schedules/new" className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
              Create your first schedule
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Section */}
          {overdueSchedules.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3">
                Overdue ({overdueSchedules.length})
              </h2>
              <div className="bg-white rounded-lg shadow-sm border border-red-200">
                <div className="divide-y divide-red-100">
                  {overdueSchedules.map((schedule) => (
                    <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50/50">
                      <div className="flex-1 min-w-0">
                        <Link href={`/schedules/${schedule.id}`} className="font-medium text-blue-600 hover:text-blue-800 block">
                          {schedule.title}
                        </Link>
                        <p className="text-sm text-gray-500">
                          <Link href={`/equipment/${schedule.equipmentId}`} className="text-blue-600 hover:text-blue-800">
                            {schedule.equipment.name}
                          </Link>
                          {" "}&bull; <span className="capitalize">{schedule.frequency}</span>
                          {schedule.assignedTo && <>{" "}&bull; {schedule.assignedTo.name}</>}
                        </p>
                        {schedule.description && (
                          <p className="text-sm text-gray-400 mt-0.5">{schedule.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-red-600">OVERDUE</p>
                          <p className="text-sm text-red-500">
                            Was due {new Date(schedule.nextDue).toLocaleDateString()}
                          </p>
                        </div>
                        {isAdmin && (
                          <ScheduleRowActions
                            scheduleId={schedule.id}
                            scheduleTitle={schedule.title}
                            currentStatus={schedule.boardStatus}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {upcomingSchedules.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Upcoming ({upcomingSchedules.length})
              </h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="divide-y divide-gray-100">
                  {upcomingSchedules.map((schedule) => {
                    const daysUntil = Math.ceil(
                      (new Date(schedule.nextDue).getTime() - now.getTime()) / 86400000
                    );
                    return (
                      <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <Link href={`/schedules/${schedule.id}`} className="font-medium text-blue-600 hover:text-blue-800 block">
                            {schedule.title}
                          </Link>
                          <p className="text-sm text-gray-500">
                            <Link href={`/equipment/${schedule.equipmentId}`} className="text-blue-600 hover:text-blue-800">
                              {schedule.equipment.name}
                            </Link>
                            {" "}&bull; <span className="capitalize">{schedule.frequency}</span>
                          </p>
                          {schedule.description && (
                            <p className="text-sm text-gray-400 mt-0.5">{schedule.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          <div className="text-left sm:text-right">
                            <p className={`text-sm font-medium ${daysUntil <= 3 ? "text-orange-600" : "text-gray-600"}`}>
                              {daysUntil === 0 ? "Due today" : daysUntil === 1 ? "Due tomorrow" : `Due in ${daysUntil} days`}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(schedule.nextDue).toLocaleDateString()}
                            </p>
                          </div>
                          {isAdmin && (
                            <ScheduleRowActions
                              scheduleId={schedule.id}
                              scheduleTitle={schedule.title}
                              currentStatus={schedule.boardStatus}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
