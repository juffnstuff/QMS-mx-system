import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { equipment: true, assignedTo: true, secondaryAssignedTo: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, description, frequency, nextDue, assignedToId, secondaryAssignedToId } = body;

  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(frequency !== undefined && { frequency }),
      ...(nextDue !== undefined && { nextDue: new Date(nextDue) }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      ...(secondaryAssignedToId !== undefined && { secondaryAssignedToId: secondaryAssignedToId || null }),
    },
  });

  return NextResponse.json(schedule);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.maintenanceSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
