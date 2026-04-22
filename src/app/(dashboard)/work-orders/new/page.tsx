import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { WorkOrderForm } from "@/components/work-order-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
  titleFromMessage,
} from "@/lib/m365/promote-message";

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const session = await auth();
  const { fromMessageId } = await searchParams;

  const [equipment, users, sourceMessage] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    fetchMessageForPrefill(fromMessageId),
  ]);

  const prefill = sourceMessage
    ? {
        title: titleFromMessage(sourceMessage) || "(From email)",
        description: descriptionFromMessage(sourceMessage),
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Work Order</h1>
      <WorkOrderForm
        equipment={equipment}
        users={users}
        isAdmin={session?.user.role === "admin"}
        prefill={prefill}
      />
    </div>
  );
}
