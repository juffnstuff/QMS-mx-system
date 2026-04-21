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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title, description, keywords, status, priority, budget, dueDate,
      phase, projectJustification, designObjectives, designRequirements,
      potentialVendors, salesMarketingActions, engineeringActions,
      releaseChecklist, actualBudget, plannedSchedule, actualSchedule,
      isComplete, contingentDetails, projectLeadId, secondaryLeadId,
      parentProjectId, fromMessageId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Enforce 2-level hierarchy: chosen parent cannot itself be a sub-project.
    if (parentProjectId) {
      const parent = await prisma.project.findUnique({
        where: { id: parentProjectId },
        select: { id: true, parentProjectId: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent project not found" }, { status: 400 });
      }
      if (parent.parentProjectId) {
        return NextResponse.json(
          { error: "Parent must be a top-level project" },
          { status: 400 },
        );
      }
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
        parentProjectId: parentProjectId || null,
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

    // If this project was promoted from an email, mark the source message so
    // the activity feed links to the created project and cleanup skips it.
    if (fromMessageId && typeof fromMessageId === "string") {
      await prisma.processedMessage.updateMany({
        where: { id: fromMessageId },
        data: { actionTaken: "promoted_to_project" },
      }).catch((e) => console.error("[Projects] Failed to mark source message:", e));

      await prisma.aISuggestion.create({
        data: {
          processedMessageId: fromMessageId,
          suggestionType: "create_project",
          kind: "project",
          status: "approved",
          payload: JSON.stringify({ title, description, source: "email_promotion" }),
          createdRecordType: "Project",
          createdRecordId: project.id,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNote: "Promoted from email by operator",
        },
      }).catch((e) => console.error("[Projects] Failed to log promotion suggestion:", e));
    }

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
