import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/checklists — list completions. Supports ?status, ?equipmentId,
// ?technicianId, ?mine=true (= assigned to current user).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const equipmentId = searchParams.get("equipmentId");
  const technicianId = searchParams.get("technicianId");
  const mine = searchParams.get("mine") === "true";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (equipmentId) where.equipmentId = equipmentId;
  if (technicianId) where.technicianId = technicianId;
  if (mine) where.technicianId = session.user.id;

  const completions = await prisma.checklistCompletion.findMany({
    where,
    include: {
      template: { select: { name: true, frequency: true, scope: true } },
      equipment: { select: { id: true, name: true, serialNumber: true, criticality: true } },
      technician: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(completions);
}
