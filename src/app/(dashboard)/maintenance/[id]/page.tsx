import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { NotesSection } from "@/components/notes/notes-section";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

export default async function MaintenanceLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const log = await prisma.maintenanceLog.findUnique({
    where: { id },
    include: {
      equipment: { select: { id: true, name: true, serialNumber: true } },
      user: { select: { id: true, name: true } },
      sourceChecklistCompletion: {
        select: { id: true, template: { select: { name: true } } },
      },
    },
  });

  if (!log) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Maintenance Log", href: "/maintenance" },
          { label: `${log.equipment.name} — ${new Date(log.performedAt).toLocaleDateString()}` },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Entry</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <Link href={`/equipment/${log.equipment.id}`} className="text-blue-600 hover:text-blue-800">
            {log.equipment.name}
          </Link>
          <span className="ml-2 font-mono text-gray-400">{log.equipment.serialNumber}</span>
        </p>
      </div>

      {log.sourceChecklistCompletion && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-green-900">
            <ClipboardCheck size={16} />
            <span>
              Auto-logged from the{" "}
              <span className="font-medium">{log.sourceChecklistCompletion.template.name}</span>{" "}
              PM checklist.
            </span>
          </div>
          <Link
            href={`/checklists/${log.sourceChecklistCompletion.id}`}
            className="text-sm font-medium text-green-700 hover:text-green-900 whitespace-nowrap"
          >
            View full checklist →
          </Link>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <dt className="text-sm text-gray-500">Description</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{log.description}</dd>
          </div>
          {log.partsUsed && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Parts Used</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{log.partsUsed}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Performed By</dt>
            <dd className="text-gray-900">
              <Link href={`/users?highlight=${log.user.id}`} className="text-blue-600 hover:text-blue-800">
                {log.user.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Performed At</dt>
            <dd className="text-gray-900">
              {new Date(log.performedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mb-6">
        <NotesSection
          recordType="maintenance_log"
          recordId={id}
          currentUserId={session?.user.id ?? ""}
          isAdmin={session?.user.role === "admin"}
        />
      </div>

      <AttachmentsSection
        recordType="maintenance_log"
        recordId={id}
        currentUserId={session?.user.id ?? ""}
        isAdmin={session?.user.role === "admin"}
      />
    </div>
  );
}
