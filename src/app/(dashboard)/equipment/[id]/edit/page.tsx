import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EquipmentForm } from "@/components/equipment-form";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/equipment");

  const [equipment, allEquipment, users] = await Promise.all([
    prisma.equipment.findUnique({ where: { id } }),
    prisma.equipment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, serialNumber: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  if (!equipment) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Equipment</h1>
      <EquipmentForm equipment={equipment} allEquipment={allEquipment} users={users} />
    </div>
  );
}
