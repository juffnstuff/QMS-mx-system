import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestNotificationToAdmins } from "@/lib/notifications/send-notification";
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
    const recent = await prisma.notification.findFirst({
      where: { type: "work_order_due", createdAt: { gte: oneDayAgo } },
    });

    if (recent) {
      return NextResponse.json({
        message: "Already notified within 24h",
        overdueCount: overdueOrders.length,
        notified: false,
      });
    }

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

    return NextResponse.json({
      message: "Notifications sent",
      overdueCount: overdueOrders.length,
      notified: true,
    });
  } catch (error) {
    console.error("Check work orders error:", error);
    return NextResponse.json({ error: "Failed to check work orders" }, { status: 500 });
  }
}
