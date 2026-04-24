import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markMessagePromoted } from "@/lib/m365/promote-message";
import { withYearlyNumber } from "@/lib/record-numbering";

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
      secondaryInvestigatorId,
      fromMessageId,
    } = body;

    if (!ncrType || !requirementDescription || !nonConformanceDescription) {
      return NextResponse.json(
        { error: "NCR type, requirement description, and non-conformance description are required" },
        { status: 400 }
      );
    }

    // Auto-generate ncrNumber (race-safe via pg advisory lock).
    const ncr = await withYearlyNumber("NCR", {
      countCurrent: (tx, { startOfYear, endOfYear }) =>
        tx.nonConformance.count({
          where: { createdAt: { gte: startOfYear, lt: endOfYear } },
        }),
      run: (tx, ncrNumber) =>
        tx.nonConformance.create({
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
            secondaryInvestigatorId: secondaryInvestigatorId || null,
            status: "open",
          },
        }),
    });

    await markMessagePromoted({
      fromMessageId,
      kind: "ncr",
      createdRecordId: ncr.id,
      reviewerId: session.user.id,
      payloadSummary: { ncrNumber: ncr.ncrNumber, ncrType, nonConformanceDescription },
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
