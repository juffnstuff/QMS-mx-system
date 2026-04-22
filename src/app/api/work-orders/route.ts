import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendNotification,
  sendDigestToAdminsAndUsers,
} from "@/lib/notifications/send-notification";
import {
  workOrderAssigned,
  workOrderCreated,
} from "@/lib/notifications/email-templates";
import { markMessagePromoted } from "@/lib/m365/promote-message";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    equipmentId, title, description, priority, assignedToId, secondaryAssignedToId, dueDate,
    workOrderType, requirements, managerNotes, estimatedBudget, estimatedLeadTime, plannedStartDate,
    fromMessageId,
  } = body;

  if (!equipmentId || !title || !description) {
    return NextResponse.json(
      { error: "Equipment, title, and description are required" },
      { status: 400 }
    );
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      equipmentId,
      title,
      description,
      priority: priority || "medium",
      assignedToId: assignedToId || null,
      secondaryAssignedToId: secondaryAssignedToId || null,
      createdById: session.user.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      workOrderType: workOrderType || "corrective",
      requirements: requirements || null,
      managerNotes: managerNotes || null,
      estimatedBudget: estimatedBudget || null,
      estimatedLeadTime: estimatedLeadTime || null,
      plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
    },
  });

  // Notify primary + secondary assignee on creation (deduped; skip creator).
  const assigneeIds = new Set<string>();
  if (assignedToId && assignedToId !== session.user.id) assigneeIds.add(assignedToId);
  if (
    secondaryAssignedToId &&
    secondaryAssignedToId !== session.user.id &&
    secondaryAssignedToId !== assignedToId
  ) {
    assigneeIds.add(secondaryAssignedToId);
  }

  for (const uid of assigneeIds) {
    const assignee = await prisma.user.findUnique({ where: { id: uid } });
    if (!assignee) continue;
    const isSecondary = uid === secondaryAssignedToId;
    const email = workOrderAssigned(title, assignee.name, workOrder.id);
    sendNotification({
      userId: uid,
      type: "work_order_assigned",
      urgency: "digest",
      title: `Work Order Assigned: ${title}`,
      message: `You've been assigned${isSecondary ? " as secondary" : ""} to work order "${title}"`,
      relatedType: "WorkOrder",
      relatedId: workOrder.id,
      emailSubject: email.subject,
      emailHtml: email.html,
      smsText: email.plain,
    }).catch((e) => console.error("[Notification] assignee failed:", e));
  }

  // Digest-level notice to admins + secondary assignee about the new WO
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { name: true },
  });
  const created = workOrderCreated(
    title,
    equipment?.name || "Unknown equipment",
    priority || "medium",
    workOrder.id
  );
  sendDigestToAdminsAndUsers(
    {
      type: "work_order_created",
      title: created.subject,
      message: `New work order on ${equipment?.name || "equipment"}: ${title}`,
      relatedType: "WorkOrder",
      relatedId: workOrder.id,
      emailSubject: created.subject,
      emailHtml: created.html,
      smsText: created.plain,
    },
    [secondaryAssignedToId]
  ).catch((e) => console.error("[Notification] work_order_created digest failed:", e));

  await markMessagePromoted({
    fromMessageId,
    kind: "work_order",
    createdRecordId: workOrder.id,
    reviewerId: session.user.id,
    payloadSummary: { title, description, priority },
  });

  return NextResponse.json(workOrder, { status: 201 });
}
