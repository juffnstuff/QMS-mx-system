import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markMessagePromoted } from "@/lib/m365/promote-message";
import { withYearlyNumber } from "@/lib/record-numbering";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const severityLevel = searchParams.get("severityLevel");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (severityLevel && severityLevel !== "all") {
      where.severityLevel = severityLevel;
    }

    const capas = await prisma.cAPA.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        originator: true,
        assignedTo: true,
        referenceNcr: true,
        actions: true,
      },
      take: 50,
    });

    return NextResponse.json(capas);
  } catch (error) {
    console.error("[CAPA GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch CAPAs" },
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
      department,
      referenceNcrId,
      targetCloseDate,
      assignedToId,
      secondaryAssignedToId,
      source,
      sourceOther,
      severityLevel,
      nonconformanceDescription,
      productProcessAffected,
      quantityScopeAffected,
      containmentActions,
      rcaMethod,
      rcaMethodOther,
      whyMan,
      whyMachine,
      whyMethod,
      whyMaterial,
      rootCauseStatement,
      verificationMethod,
      effectivenessOutcome,
      objectiveEvidence,
      lessonsLearned,
      preventiveActions,
      finalDisposition,
      status,
      actions,
      fromMessageId,
    } = body;

    if (!source || !severityLevel || !nonconformanceDescription) {
      return NextResponse.json(
        { error: "Source, severity level, and nonconformance description are required" },
        { status: 400 }
      );
    }

    // Auto-generate capaNumber (race-safe via pg advisory lock).
    const capa = await withYearlyNumber("CAPA", {
      countCurrent: (tx, { startOfYear, endOfYear }) =>
        tx.cAPA.count({
          where: { createdAt: { gte: startOfYear, lt: endOfYear } },
        }),
      run: (tx, capaNumber) => tx.cAPA.create({
      data: {
        capaNumber,
        originatorId: session.user.id,
        department: department || null,
        referenceNcrId: referenceNcrId || null,
        targetCloseDate: targetCloseDate ? new Date(targetCloseDate) : null,
        assignedToId: assignedToId || null,
        secondaryAssignedToId: secondaryAssignedToId || null,
        source,
        sourceOther: sourceOther || null,
        severityLevel,
        nonconformanceDescription,
        productProcessAffected: productProcessAffected || null,
        quantityScopeAffected: quantityScopeAffected || null,
        containmentActions: containmentActions || null,
        rcaMethod: rcaMethod || null,
        rcaMethodOther: rcaMethodOther || null,
        whyMan: whyMan || null,
        whyMachine: whyMachine || null,
        whyMethod: whyMethod || null,
        whyMaterial: whyMaterial || null,
        rootCauseStatement: rootCauseStatement || null,
        verificationMethod: verificationMethod || null,
        effectivenessOutcome: effectivenessOutcome || null,
        objectiveEvidence: objectiveEvidence || null,
        lessonsLearned: lessonsLearned || null,
        preventiveActions: preventiveActions || null,
        finalDisposition: finalDisposition || null,
        status: status || "open",
        actions: actions?.length
          ? {
              create: actions.map(
                (
                  a: {
                    description: string;
                    responsibleParty?: string;
                    dueDate?: string;
                    status?: string;
                  },
                  idx: number
                ) => ({
                  actionNumber: idx + 1,
                  description: a.description,
                  responsibleParty: a.responsibleParty || null,
                  dueDate: a.dueDate ? new Date(a.dueDate) : null,
                  status: a.status || "planned",
                })
              ),
            }
          : undefined,
      },
      include: { actions: true },
    }),
    });

    await markMessagePromoted({
      fromMessageId,
      kind: "capa",
      createdRecordId: capa.id,
      reviewerId: session.user.id,
      payloadSummary: { capaNumber: capa.capaNumber, severityLevel, nonconformanceDescription },
    });

    return NextResponse.json(capa, { status: 201 });
  } catch (error) {
    console.error("[CAPA POST]", error);
    return NextResponse.json(
      { error: "Failed to create CAPA" },
      { status: 500 }
    );
  }
}
