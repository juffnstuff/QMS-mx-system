import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScheduleForm } from "@/components/schedule-form";

export default async function NewSchedulePage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/schedules");

  const equipment = await prisma.equipment.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Maintenance Schedule</h1>
      <ScheduleForm equipment={equipment} />
    </div>
  );
}
