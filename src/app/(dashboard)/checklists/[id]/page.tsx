import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChecklistForm } from "@/components/checklist-form";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) notFound();

  const completion = await prisma.checklistCompletion.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      equipment: {
        select: {
          id: true,
          name: true,
          serialNumber: true,
          criticality: true,
          assignedTechnicianId: true,
        },
      },
      results: true,
      technician: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
      schedule: { select: { id: true, title: true } },
      supersededBy: { select: { id: true } },
    },
  });
  if (!completion) notFound();

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const readOnly =
    completion.status === "completed" || completion.status === "superseded";

  // Build initial form state: one entry per item pre-populated from existing results.
  const resultByItem = new Map(completion.results.map((r) => [r.itemId, r]));
  const initialItems = completion.template.items.map((item) => {
    const r = resultByItem.get(item.id);
    return {
      id: item.id,
      sortOrder: item.sortOrder,
      section: item.section,
      label: item.label,
      details: item.details,
      inputType: item.inputType,
      isCritical: item.isCritical,
      escalationNote: item.escalationNote,
      resultId: r?.id ?? null,
      result: r?.result ?? "pending",
      value: r?.value ?? "",
      notes: r?.notes ?? "",
    };
  });

  const statusColor =
    completion.status === "completed"
      ? "text-green-600 bg-green-100"
      : completion.status === "superseded"
      ? "text-gray-500 bg-gray-100"
      : completion.status === "in_progress"
      ? "text-blue-600 bg-blue-100"
      : "text-amber-700 bg-amber-100";

  return (
    <div className="max-w-4xl">
      <Link
        href="/checklists"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4"
      >
        <ArrowLeft size={14} /> Back to checklists
      </Link>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {completion.template.name}
          </h1>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${statusColor}`}
          >
            {completion.status.replace("_", " ")}
          </span>
          {completion.equipment.criticality === "A" && (
            <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
              CLASS A
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">
          <Link
            href={`/equipment/${completion.equipment.id}`}
            className="text-blue-600 hover:text-blue-800"
          >
            {completion.equipment.name}
          </Link>{" "}
          · {completion.equipment.serialNumber} · Scheduled{" "}
          {new Date(completion.scheduledFor).toLocaleDateString()}
        </p>
        {completion.template.description && (
          <p className="text-sm text-gray-500 mt-2">{completion.template.description}</p>
        )}
      </div>

      {completion.status === "superseded" && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-3 flex items-start gap-2 text-sm text-gray-700">
          <CheckCircle2 size={16} className="text-gray-500 mt-0.5 shrink-0" />
          <div>
            This checklist was superseded by a higher-frequency PM completed the same day.{" "}
            {completion.supersededBy && (
              <Link
                href={`/checklists/${completion.supersededBy.id}`}
                className="text-blue-600 hover:text-blue-800"
              >
                View superseding checklist →
              </Link>
            )}
          </div>
        </div>
      )}

      {completion.status === "completed" && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2 text-sm text-green-800">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            Completed{" "}
            {completion.completedAt &&
              new Date(completion.completedAt).toLocaleString()}{" "}
            by {completion.technician?.name ?? "—"}
            {completion.supervisor && (
              <> · Supervisor: {completion.supervisor.name}</>
            )}
          </div>
        </div>
      )}

      <ChecklistForm
        completionId={completion.id}
        status={completion.status}
        readOnly={readOnly}
        initialItems={initialItems}
        initialNotes={completion.notes ?? ""}
        initialSupervisorId={completion.supervisorId ?? ""}
        users={users}
        currentUserName={session.user.name ?? ""}
      />

      {!readOnly && (
        <div className="mt-6 text-xs text-gray-500 flex items-start gap-1">
          <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            Items marked{" "}
            <span className="font-semibold text-red-600">CRITICAL</span> will auto-create a
            WorkOrder if failed. Escalation details appear under each critical item.
          </span>
        </div>
      )}
    </div>
  );
}
