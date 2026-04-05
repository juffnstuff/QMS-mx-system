import { prisma } from "@/lib/prisma";
import { Calendar } from "lucide-react";

export default async function SchedulesPage() {
  const schedules = await prisma.maintenanceSchedule.findMany({
    orderBy: { nextDue: "asc" },
    include: { equipment: true },
  });

  const now = new Date();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Maintenance Schedules</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {schedules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No maintenance schedules configured yet.</p>
            <p className="text-sm mt-1">Schedules will appear here once added to equipment.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {schedules.map((schedule) => {
              const isOverdue = new Date(schedule.nextDue) < now;
              return (
                <div key={schedule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{schedule.title}</p>
                    <p className="text-sm text-gray-500">
                      {schedule.equipment.name} • <span className="capitalize">{schedule.frequency}</span>
                    </p>
                    {schedule.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{schedule.description}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={`text-sm font-medium ${isOverdue ? "text-red-600" : "text-gray-600"}`}>
                      {isOverdue ? "OVERDUE" : "Next due"}
                    </p>
                    <p className={`text-sm ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
                      {new Date(schedule.nextDue).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
