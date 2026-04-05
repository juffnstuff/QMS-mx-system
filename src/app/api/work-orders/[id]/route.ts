import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json(workOrder);
}
