import { prisma } from "@/lib/prisma";
import { ComplaintForm } from "@/components/complaint-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
} from "@/lib/m365/promote-message";

export default async function NewComplaintPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const { fromMessageId } = await searchParams;
  const [users, sourceMessage] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    fetchMessageForPrefill(fromMessageId),
  ]);

  const prefill = sourceMessage
    ? {
        complaintDescription: descriptionFromMessage(sourceMessage),
        customerName: sourceMessage.senderName ?? "",
        contactEmail: sourceMessage.senderEmail ?? "",
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Customer Complaint</h1>
      <ComplaintForm users={users} prefill={prefill} />
    </div>
  );
}
