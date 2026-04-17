import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestNotificationToAdmins } from "@/lib/notifications/send-notification";
import { notifyAssigneesForOverdueRecords } from "@/lib/notifications/assignee-overdue";
import { workOrdersDue } from "@/lib/notifications/email-templates";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overdueOrders = await prisma.workOrder.findMany({
      where: {
        dueDate: { lte: new Date() },
        status: { in: ["open", "in_progress"] },
      },
      include: {
        equipment: { select: { name: true } },
      },
    });

    if (overdueOrders.length === 0) {
      return NextResponse.json({ message: "No overdue work orders", notified: false });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAdmin = await prisma.notification.findFirst({
      where: { type: "work_order_due", createdAt: { gte: oneDayAgo } },
    });

    let adminNotified = false;
    if (!recentAdmin) {
      const orderInfo = overdueOrders.map((o) => ({
        title: o.title,
        equipmentName: o.equipment.name,
        dueDate: new Date(o.dueDate!).toLocaleDateString(),
      }));

      const email = workOrdersDue(orderInfo);
      await sendDigestNotificationToAdmins({
        type: "work_order_due",
        title: email.subject,
        message: `${overdueOrders.length} work order${overdueOrders.length !== 1 ? "s are" : " is"} overdue.`,
        relatedType: "WorkOrder",
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      });
      adminNotified = true;
    }

    // Per-assignee digest (primary + secondary). Non-admins only; the helper
    // dedupes across the three overdue crons via its own 24h assignee_overdue
    // check so admins who already got the digest above aren't double-emailed.
    const assigneeResult = await notifyAssigneesForOverdueRecords(
      overdueOrders.map((o) => ({
        assigneeIds: [o.assignedToId, o.secondaryAssignedToId],
      }))
    );

    return NextResponse.json({
      message: "Notifications processed",
      overdueCount: overdueOrders.length,
      adminNotified,
      assigneesNotified: assigneeResult.notified,
    });
  } catch (error) {
    console.error("Check work orders error:", error);
    return NextResponse.json({ error: "Failed to check work orders" }, { status: 500 });
  }
}
