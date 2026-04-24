import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EquipmentForm } from "@/components/equipment-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
  titleFromMessage,
} from "@/lib/m365/promote-message";

export default async function NewEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/equipment");
  const { fromMessageId } = await searchParams;

  const [allEquipment, users, sourceMessage] = await Promise.all([
    prisma.equipment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, serialNumber: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    fetchMessageForPrefill(fromMessageId),
  ]);

  const prefill = sourceMessage
    ? {
        name: titleFromMessage(sourceMessage),
        notes: descriptionFromMessage(sourceMessage),
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Equipment</h1>
      <EquipmentForm allEquipment={allEquipment} users={users} prefill={prefill} />
    </div>
  );
}
