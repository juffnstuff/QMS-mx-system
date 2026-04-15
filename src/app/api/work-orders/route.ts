import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification, sendDigestToAdminsAndUsers } from "@/lib/notifications/send-notification";
import { workOrderAssigned, workOrderCreated } from "@/lib/notifications/email-templates";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    equipmentId, title, description, priority, assignedToId, dueDate,
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

  // Digest notification for new work order — admins + assignee
  const involvedUsers: string[] = [];
  if (assignedToId && assignedToId !== session.user.id) {
    involvedUsers.push(assignedToId);
  }

  const woEmail = workOrderCreated(title, priority || "medium", workOrder.id);
  sendDigestToAdminsAndUsers(involvedUsers, {
    type: "work_order_created",
    title: woEmail.subject,
    message: `New ${priority || "medium"} priority work order: ${title}`,
    relatedType: "WorkOrder",
    relatedId: workOrder.id,
  }).catch((e) => console.error("[Notification] WO created failed:", e));

  // If assigned, also give assignee a specific "assigned" digest notification
  if (assignedToId && assignedToId !== session.user.id) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (assignee) {
      sendNotification({
        userId: assignedToId,
        type: "work_order_assigned",
        title: `Work Order Assigned: ${title}`,
        message: `You've been assigned work order "${title}"`,
        urgency: "digest",
        relatedType: "WorkOrder",
        relatedId: workOrder.id,
      }).catch((e) => console.error("[Notification] WO assigned failed:", e));
    }
  }

  return NextResponse.json(workOrder, { status: 201 });
}
