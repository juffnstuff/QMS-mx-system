import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { ScheduleForm } from "@/components/schedule-form";

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/schedules");

  const [schedule, equipment, users] = await Promise.all([
    prisma.maintenanceSchedule.findUnique({ where: { id } }),
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  if (!schedule) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Schedule</h1>
      <ScheduleForm
        equipment={equipment}
        users={users}
        schedule={{
          ...schedule,
          nextDue: schedule.nextDue.toISOString(),
        }}
      />
    </div>
  );
}
