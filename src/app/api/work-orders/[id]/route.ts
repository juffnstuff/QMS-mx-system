import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { statusChanged, workOrderAssigned } from "@/lib/notifications/email-templates";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    status, assignedToId, secondaryAssignedToId,
    priority, title, description, dueDate,
  } = body;

  // Fetch existing to detect changes
  const existing = await prisma.workOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) {
    updateData.status = status;
    if (status === "completed") {
      updateData.completedAt = new Date();
    }
  }
  if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
  if (secondaryAssignedToId !== undefined) {
    updateData.secondaryAssignedToId = secondaryAssignedToId || null;
  }
  if (priority !== undefined) updateData.priority = priority;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: updateData,
  });

  // Notify on status change
  if (status && status !== existing.status) {
    const email = statusChanged(existing.title, existing.status, status, id);
    const notifyUserIds = new Set<string>();
    if (existing.createdById !== session.user.id) notifyUserIds.add(existing.createdById);
    if (existing.assignedToId && existing.assignedToId !== session.user.id) notifyUserIds.add(existing.assignedToId);

    for (const userId of notifyUserIds) {
      sendNotification({
        userId,
        type: "status_changed",
        urgency: "digest",
        title: `Work Order Updated: ${existing.title}`,
        message: `Status changed from ${existing.status} to ${status}`,
        relatedType: "WorkOrder",
        relatedId: id,
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      }).catch((e) => console.error("[Notification] status_changed failed:", e));
    }
  }

  // Notify on reassignment — digest-level
  if (assignedToId && assignedToId !== existing.assignedToId && assignedToId !== session.user.id) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (assignee) {
      const email = workOrderAssigned(existing.title, assignee.name, id);
      sendNotification({
        userId: assignedToId,
        type: "work_order_assigned",
        urgency: "digest",
        title: `Work Order Assigned: ${existing.title}`,
        message: `You've been assigned work order "${existing.title}"`,
        relatedType: "WorkOrder",
        relatedId: id,
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      }).catch((e) => console.error("[Notification] work_order_assigned failed:", e));
    }
  }

  return NextResponse.json(workOrder);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.workOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete work order:", error);
    return NextResponse.json({ error: "Failed to delete work order" }, { status: 500 });
  }
}
