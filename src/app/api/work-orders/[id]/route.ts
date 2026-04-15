import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";

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
  const { status, assignedToId, priority, title, description, dueDate } = body;

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
  if (priority !== undefined) updateData.priority = priority;
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

  const workOrder = await prisma.workOrder.update({
    where: { id },
    data: updateData,
  });

  // Digest notification on status change — notify creator + assignee
  if (status && status !== existing.status) {
    const notifyUserIds = new Set<string>();
    if (existing.createdById !== session.user.id) notifyUserIds.add(existing.createdById);
    if (existing.assignedToId && existing.assignedToId !== session.user.id) notifyUserIds.add(existing.assignedToId);

    for (const userId of notifyUserIds) {
      sendNotification({
        userId,
        type: "status_changed",
        title: `Work Order Updated: ${existing.title}`,
        message: `Status changed from ${existing.status} to ${status}`,
        urgency: "digest",
        relatedType: "WorkOrder",
        relatedId: id,
      }).catch((e) => console.error("[Notification] Failed:", e));
    }
  }

  // Digest notification on reassignment
  if (assignedToId && assignedToId !== existing.assignedToId && assignedToId !== session.user.id) {
    sendNotification({
      userId: assignedToId,
      type: "work_order_assigned",
      title: `Work Order Assigned: ${existing.title}`,
      message: `You've been assigned work order "${existing.title}"`,
      urgency: "digest",
      relatedType: "WorkOrder",
      relatedId: id,
    }).catch((e) => console.error("[Notification] Failed:", e));
  }

  return NextResponse.json(workOrder);
}
