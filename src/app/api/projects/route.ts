import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";
import { projectAssigned } from "@/lib/notifications/email-templates";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title, description, keywords, status, priority, budget, dueDate,
      phase, projectJustification, designObjectives, designRequirements,
      potentialVendors, salesMarketingActions, engineeringActions,
      releaseChecklist, actualBudget, plannedSchedule, actualSchedule,
      isComplete, contingentDetails, projectLeadId, secondaryLeadId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title,
        description: description || null,
        keywords: keywords || null,
        status: status || "planning",
        priority: priority || "medium",
        budget: budget || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: session.user.id,
        projectLeadId: projectLeadId || null,
        secondaryLeadId: secondaryLeadId || null,
        phase: phase || "concept",
        projectJustification: projectJustification || null,
        designObjectives: designObjectives || null,
        designRequirements: designRequirements || null,
        potentialVendors: potentialVendors || null,
        salesMarketingActions: salesMarketingActions || null,
        engineeringActions: engineeringActions || null,
        releaseChecklist: releaseChecklist || null,
        actualBudget: actualBudget || null,
        plannedSchedule: plannedSchedule || null,
        actualSchedule: actualSchedule || null,
        isComplete: isComplete || null,
        contingentDetails: contingentDetails || null,
      },
    });

    // Notify lead + secondary lead on assignment (deduped, skip creator).
    const assigneeRoles: Array<{ id: string; role: "lead" | "secondary" }> = [];
    if (projectLeadId) assigneeRoles.push({ id: projectLeadId, role: "lead" });
    if (secondaryLeadId && secondaryLeadId !== projectLeadId) {
      assigneeRoles.push({ id: secondaryLeadId, role: "secondary" });
    }

    for (const { id, role } of assigneeRoles) {
      if (id === session.user.id) continue;
      const assignee = await prisma.user.findUnique({ where: { id } });
      if (!assignee) continue;
      const email = projectAssigned(title, assignee.name, project.id, role);
      sendNotification({
        userId: id,
        type: "project_assigned",
        urgency: "digest",
        title: email.subject,
        message: `You've been named the ${role === "secondary" ? "secondary lead" : "lead"} on project "${title}"`,
        relatedType: "Project",
        relatedId: project.id,
        emailSubject: email.subject,
        emailHtml: email.html,
        smsText: email.plain,
      }).catch((e) => console.error("[Notification] project assignee failed:", e));
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
