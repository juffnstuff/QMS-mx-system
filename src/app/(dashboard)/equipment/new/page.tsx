import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EquipmentForm } from "@/components/equipment-form";

export default async function NewEquipmentPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/equipment");

  const [allEquipment, users] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, serialNumber: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Equipment</h1>
      <EquipmentForm allEquipment={allEquipment} users={users} />
    </div>
  );
}
