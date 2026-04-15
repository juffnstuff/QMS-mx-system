import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { workOrderAssigned } from "@/lib/notifications/email-templates";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    equipmentId, title, description, priority, assignedToId, secondaryAssignedToId, dueDate,
    workOrderType, requirements, managerNotes, estimatedBudget, estimatedLeadTime, plannedStartDate,
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

  // Notify assignee if assigned
  if (assignedToId && assignedToId !== session.user.id) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (assignee) {
      const email = workOrderAssigned(title, assignee.name, workOrder.id);
      sendNotification({
        userId: assignedToId,
        type: "work_order_assigned",
        title: `Work Order Assigned: ${title}`,
        message: `You've been assigned work order "${title}"`,
        relatedType: "WorkOrder",
        relatedId: workOrder.id,
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      }).catch((e) => console.error("[Notification] Failed:", e));
    }
  }

  return NextResponse.json(workOrder, { status: 201 });
}
