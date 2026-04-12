import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ncr = await prisma.nonConformance.findUnique({
      where: { id },
      include: { submittedBy: true, approvedBy: true },
    });

    if (!ncr) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(ncr);
  } catch (error) {
    console.error("[NCR GET by ID]", error);
    return NextResponse.json(
      { error: "Failed to fetch NCR" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.nonConformance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const {
      partNumber,
      drawingNumber,
      drawingRevision,
      quantityAffected,
      vendor,
      otherInfo,
      ncrType,
      requirementDescription,
      nonConformanceDescription,
      disposition,
      immediateAction,
      ncrTagNumber,
      plantLocation,
      status,
      approvedById,
    } = body;

    // Only admin can change status, disposition, or approval
    const isAdmin = session.user.role === "admin";
    const updateData: Record<string, unknown> = {};

    if (partNumber !== undefined) updateData.partNumber = partNumber || null;
    if (drawingNumber !== undefined) updateData.drawingNumber = drawingNumber || null;
    if (drawingRevision !== undefined) updateData.drawingRevision = drawingRevision || null;
    if (quantityAffected !== undefined) updateData.quantityAffected = quantityAffected || null;
    if (vendor !== undefined) updateData.vendor = vendor || null;
    if (otherInfo !== undefined) updateData.otherInfo = otherInfo || null;
    if (ncrType !== undefined) updateData.ncrType = ncrType;
    if (requirementDescription !== undefined) updateData.requirementDescription = requirementDescription;
    if (nonConformanceDescription !== undefined) updateData.nonConformanceDescription = nonConformanceDescription;
    if (immediateAction !== undefined) updateData.immediateAction = immediateAction || null;
    if (ncrTagNumber !== undefined) updateData.ncrTagNumber = ncrTagNumber || null;
    if (plantLocation !== undefined) updateData.plantLocation = plantLocation || null;

    // Admin-only fields
    if (isAdmin) {
      if (status !== undefined) updateData.status = status;
      if (disposition !== undefined) updateData.disposition = disposition || null;
      if (approvedById !== undefined) {
        updateData.approvedById = approvedById || null;
        if (approvedById) {
          updateData.approvedAt = new Date();
        }
      }
    }

    const ncr = await prisma.nonConformance.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(ncr);
  } catch (error) {
    console.error("[NCR PUT]", error);
    return NextResponse.json(
      { error: "Failed to update NCR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.nonConformance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.nonConformance.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NCR DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete NCR" },
      { status: 500 }
    );
  }
}
