import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const ncrType = searchParams.get("ncrType");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (ncrType && ncrType !== "all") {
      where.ncrType = ncrType;
    }

    const ncrs = await prisma.nonConformance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { submittedBy: true, approvedBy: true },
      take: 50,
    });

    return NextResponse.json(ncrs);
  } catch (error) {
    console.error("[NCR GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch NCRs" },
      { status: 500 }
    );
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
      assignedInvestigatorId,
    } = body;

    if (!ncrType || !requirementDescription || !nonConformanceDescription) {
      return NextResponse.json(
        { error: "NCR type, requirement description, and non-conformance description are required" },
        { status: 400 }
      );
    }

    // Auto-generate ncrNumber: NCR-YYYY-001
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await prisma.nonConformance.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lt: endOfYear,
        },
      },
    });

    const ncrNumber = `NCR-${year}-${String(count + 1).padStart(3, "0")}`;

    const ncr = await prisma.nonConformance.create({
      data: {
        ncrNumber,
        submittedById: session.user.id,
        date: new Date(),
        partNumber: partNumber || null,
        drawingNumber: drawingNumber || null,
        drawingRevision: drawingRevision || null,
        quantityAffected: quantityAffected || null,
        vendor: vendor || null,
        otherInfo: otherInfo || null,
        ncrType,
        requirementDescription,
        nonConformanceDescription,
        disposition: disposition || null,
        immediateAction: immediateAction || null,
        ncrTagNumber: ncrTagNumber || null,
        plantLocation: plantLocation || null,
        assignedInvestigatorId: assignedInvestigatorId || null,
        status: "open",
      },
    });

    return NextResponse.json(ncr, { status: 201 });
  } catch (error) {
    console.error("[NCR POST]", error);
    return NextResponse.json(
      { error: "Failed to create NCR" },
      { status: 500 }
    );
  }
}
