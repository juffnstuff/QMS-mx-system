import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { name, type, location, serialNumber, status, criticality, groupName, parentId, notes } = body;

    if (!name || !type || !location || !serialNumber) {
      return NextResponse.json(
        { error: "Name, type, location, and serial number are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.equipment.findUnique({
      where: { serialNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Equipment with this serial number already exists" },
        { status: 400 }
      );
    }

    const equipment = await prisma.equipment.create({
      data: {
        name, type, location, serialNumber,
        status: status || "operational",
        criticality: criticality || "C",
        groupName: groupName || null,
        parentId: parentId || null,
        notes,
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("Failed to create equipment:", error);
    return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
  }
}
