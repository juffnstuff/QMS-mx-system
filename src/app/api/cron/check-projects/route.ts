import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDigestNotificationToAdmins } from "@/lib/notifications/send-notification";
import { projectsDue } from "@/lib/notifications/email-templates";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overdueProjects = await prisma.project.findMany({
      where: {
        dueDate: { lte: new Date() },
        status: { in: ["planning", "in_progress", "on_hold"] },
      },
    });

    if (overdueProjects.length === 0) {
      return NextResponse.json({ message: "No overdue projects", notified: false });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.notification.findFirst({
      where: { type: "project_due", createdAt: { gte: oneDayAgo } },
    });

    if (recent) {
      return NextResponse.json({
        message: "Already notified within 24h",
        overdueCount: overdueProjects.length,
        notified: false,
      });
    }

    const projectInfo = overdueProjects.map((p) => ({
      title: p.title,
      dueDate: new Date(p.dueDate!).toLocaleDateString(),
    }));

    const email = projectsDue(projectInfo);
    await sendDigestNotificationToAdmins({
      type: "project_due",
      title: email.subject,
      message: `${overdueProjects.length} project${overdueProjects.length !== 1 ? "s are" : " is"} overdue.`,
      relatedType: "Project",
      emailSubject: email.subject,
      emailHtml: email.html,
      smsText: email.plain,
    });

    return NextResponse.json({
      message: "Notifications sent",
      overdueCount: overdueProjects.length,
      notified: true,
    });
  } catch (error) {
    console.error("Check projects error:", error);
    return NextResponse.json({ error: "Failed to check projects" }, { status: 500 });
  }
}
