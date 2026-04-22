import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAPAForm } from "@/components/capa-form";
import {
  descriptionFromMessage,
  fetchMessageForPrefill,
} from "@/lib/m365/promote-message";

export default async function NewCAPAPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const session = await auth();
  const { fromMessageId } = await searchParams;

  const [users, ncrs, sourceMessage] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.nonConformance.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, ncrNumber: true },
    }),
    fetchMessageForPrefill(fromMessageId),
  ]);

  const prefill = sourceMessage
    ? {
        nonconformanceDescription: descriptionFromMessage(sourceMessage),
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create CAPA</h1>
      <CAPAForm
        users={users}
        ncrs={ncrs}
        isAdmin={session?.user.role === "admin"}
        prefill={prefill}
      />
    </div>
  );
}
