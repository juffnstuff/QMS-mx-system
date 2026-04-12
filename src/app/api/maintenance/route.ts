import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { equipmentId, description, partsUsed, performedAt } = body;

    if (!equipmentId || !description) {
      return NextResponse.json(
        { error: "Equipment and description are required" },
        { status: 400 }
      );
    }

    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId,
        userId: session.user.id,
        description,
        partsUsed: partsUsed || null,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Failed to create maintenance log:", error);
    return NextResponse.json({ error: "Failed to create maintenance log" }, { status: 500 });
  }
}
