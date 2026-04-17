import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      title, description, keywords, status, priority, budget, dueDate,
      phase, projectJustification, designObjectives, designRequirements,
      potentialVendors, salesMarketingActions, engineeringActions,
      releaseChecklist, actualBudget, plannedSchedule, actualSchedule,
      isComplete, contingentDetails, projectLeadId, secondaryLeadId,
      parentProjectId,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Handle completedAt based on status
    const existing = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Enforce 2-level hierarchy.
    if (parentProjectId) {
      if (parentProjectId === id) {
        return NextResponse.json({ error: "Project cannot be its own parent" }, { status: 400 });
      }
      if (existing._count.children > 0) {
        return NextResponse.json(
          { error: "A project with sub-projects cannot itself become a sub-project" },
          { status: 400 },
        );
      }
      const parent = await prisma.project.findUnique({
        where: { id: parentProjectId },
        select: { parentProjectId: true },
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

    let completedAt = existing.completedAt;
    if (status === "completed" && existing.status !== "completed") {
      completedAt = new Date();
    } else if (status !== "completed") {
      completedAt = null;
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        title,
        description: description || null,
        keywords: keywords !== undefined ? (keywords || null) : existing.keywords,
        status,
        priority,
        budget: budget || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        completedAt,
        projectLeadId: projectLeadId !== undefined ? (projectLeadId || null) : existing.projectLeadId,
        secondaryLeadId: secondaryLeadId !== undefined ? (secondaryLeadId || null) : existing.secondaryLeadId,
        parentProjectId: parentProjectId !== undefined ? (parentProjectId || null) : existing.parentProjectId,
        phase: phase || existing.phase,
        projectJustification: projectJustification !== undefined ? (projectJustification || null) : existing.projectJustification,
        designObjectives: designObjectives !== undefined ? (designObjectives || null) : existing.designObjectives,
        designRequirements: designRequirements !== undefined ? (designRequirements || null) : existing.designRequirements,
        potentialVendors: potentialVendors !== undefined ? (potentialVendors || null) : existing.potentialVendors,
        salesMarketingActions: salesMarketingActions !== undefined ? (salesMarketingActions || null) : existing.salesMarketingActions,
        engineeringActions: engineeringActions !== undefined ? (engineeringActions || null) : existing.engineeringActions,
        releaseChecklist: releaseChecklist !== undefined ? (releaseChecklist || null) : existing.releaseChecklist,
        actualBudget: actualBudget !== undefined ? (actualBudget || null) : existing.actualBudget,
        plannedSchedule: plannedSchedule !== undefined ? (plannedSchedule || null) : existing.plannedSchedule,
        actualSchedule: actualSchedule !== undefined ? (actualSchedule || null) : existing.actualSchedule,
        isComplete: isComplete !== undefined ? (isComplete || null) : existing.isComplete,
        contingentDetails: contingentDetails !== undefined ? (contingentDetails || null) : existing.contingentDetails,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
