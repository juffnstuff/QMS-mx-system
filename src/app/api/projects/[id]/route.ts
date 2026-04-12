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
      title, description, status, priority, budget, dueDate,
      phase, projectJustification, designObjectives, designRequirements,
      potentialVendors, salesMarketingActions, engineeringActions,
      releaseChecklist, actualBudget, plannedSchedule, actualSchedule,
      isComplete, contingentDetails,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Handle completedAt based on status
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
        status,
        priority,
        budget: budget || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        completedAt,
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
