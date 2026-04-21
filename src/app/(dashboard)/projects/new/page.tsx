import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ fromMessageId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { fromMessageId } = await searchParams;

  const [users, allProjects, sourceMessage] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.project.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, parentProjectId: true },
    }),
    fromMessageId
      ? prisma.processedMessage.findUnique({
          where: { id: fromMessageId },
          select: {
            id: true,
            subject: true,
            senderName: true,
            senderEmail: true,
            bodyPreview: true,
            receivedAt: true,
          },
        })
      : Promise.resolve(null),
  ]);

  // Build prefill values from the source email so the user starts with a
  // reasonable draft instead of an empty form.
  const prefill = sourceMessage
    ? {
        title: sourceMessage.subject?.replace(/^(re|fwd?):\s*/i, "").trim() || "(Untitled email)",
        description:
          `Created from email received ${new Date(sourceMessage.receivedAt).toLocaleDateString()}` +
          (sourceMessage.senderName ? ` from ${sourceMessage.senderName}` : "") +
          (sourceMessage.senderEmail ? ` <${sourceMessage.senderEmail}>` : "") +
          `.\n\n${sourceMessage.bodyPreview}`,
        fromMessageId: sourceMessage.id,
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {sourceMessage ? "New Project from Email" : "New Project"}
      </h1>
      {sourceMessage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
          Prefilled from email: <span className="font-medium">{sourceMessage.subject || "(no subject)"}</span>
          {sourceMessage.senderName && (
            <span className="text-blue-700"> — from {sourceMessage.senderName}</span>
          )}
        </div>
      )}
      <ProjectForm users={users} allProjects={allProjects} prefill={prefill} />
    </div>
  );
}
