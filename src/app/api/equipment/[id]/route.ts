import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, type, location, serialNumber, status, notes } = body;

  if (!name || !type || !location || !serialNumber) {
    return NextResponse.json(
      { error: "Name, type, location, and serial number are required" },
      { status: 400 }
    );
  }

  // Check for duplicate serial number (excluding current equipment)
  const existing = await prisma.equipment.findFirst({
    where: { serialNumber, NOT: { id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Another equipment with this serial number already exists" },
      { status: 400 }
    );
  }

  const equipment = await prisma.equipment.update({
    where: { id },
    data: { name, type, location, serialNumber, status, notes },
  });

  return NextResponse.json(equipment);
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
  await prisma.equipment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
