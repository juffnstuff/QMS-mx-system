import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NCRForm } from "@/components/ncr-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
} from "@/lib/m365/promote-message";

export default async function NewNCRPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const session = await auth();
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
        nonConformanceDescription: descriptionFromMessage(sourceMessage),
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Non-Conformance Report</h1>
      <NCRForm isAdmin={session?.user.role === "admin"} users={users} prefill={prefill} />
    </div>
  );
}
