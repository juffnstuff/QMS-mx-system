import { prisma } from "@/lib/prisma";
import { MaintenanceLogForm } from "@/components/maintenance-log-form";

export default async function NewMaintenanceLogPage() {
  const equipment = await prisma.equipment.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Log Maintenance Event</h1>
      <MaintenanceLogForm equipment={equipment} />
    </div>
  );
}
