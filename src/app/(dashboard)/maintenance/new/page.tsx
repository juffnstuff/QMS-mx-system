import { prisma } from "@/lib/prisma";
import { MaintenanceLogForm } from "@/components/maintenance-log-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
} from "@/lib/m365/promote-message";

export default async function NewMaintenanceLogPage({
  searchParams,
}: {
  searchParams: Promise<{ equipmentId?: string; fromMessageId?: string }>;
}) {
  const { equipmentId, fromMessageId } = await searchParams;
  const [equipment, sourceMessage] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    fetchMessageForPrefill(fromMessageId),
  ]);

  const prefill = sourceMessage
    ? {
        description: descriptionFromMessage(sourceMessage),
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Log Maintenance Event</h1>
      <MaintenanceLogForm
        equipment={equipment}
        defaultEquipmentId={equipmentId}
        prefill={prefill}
      />
    </div>
  );
}
