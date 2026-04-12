import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const capa = await prisma.cAPA.findUnique({
      where: { id },
      include: {
        originator: true,
        assignedTo: true,
        referenceNcr: true,
        verifiedBy: true,
        actions: { orderBy: { actionNumber: "asc" } },
      },
    });

    if (!capa) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(capa);
  } catch (error) {
    console.error("[CAPA GET by ID]", error);
    return NextResponse.json(
      { error: "Failed to fetch CAPA" },
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

    const existing = await prisma.cAPA.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const {
      department,
      referenceNcrId,
      targetCloseDate,
      assignedToId,
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
      verifiedById,
      verificationDate,
      effectivenessOutcome,
      objectiveEvidence,
      lessonsLearned,
      preventiveActions,
      finalDisposition,
      status,
      actions,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (department !== undefined) updateData.department = department || null;
    if (referenceNcrId !== undefined) updateData.referenceNcrId = referenceNcrId || null;
    if (targetCloseDate !== undefined) updateData.targetCloseDate = targetCloseDate ? new Date(targetCloseDate) : null;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
    if (source !== undefined) updateData.source = source;
    if (sourceOther !== undefined) updateData.sourceOther = sourceOther || null;
    if (severityLevel !== undefined) updateData.severityLevel = severityLevel;
    if (nonconformanceDescription !== undefined) updateData.nonconformanceDescription = nonconformanceDescription;
    if (productProcessAffected !== undefined) updateData.productProcessAffected = productProcessAffected || null;
    if (quantityScopeAffected !== undefined) updateData.quantityScopeAffected = quantityScopeAffected || null;
    if (containmentActions !== undefined) updateData.containmentActions = containmentActions || null;
    if (rcaMethod !== undefined) updateData.rcaMethod = rcaMethod || null;
    if (rcaMethodOther !== undefined) updateData.rcaMethodOther = rcaMethodOther || null;
    if (whyMan !== undefined) updateData.whyMan = whyMan || null;
    if (whyMachine !== undefined) updateData.whyMachine = whyMachine || null;
    if (whyMethod !== undefined) updateData.whyMethod = whyMethod || null;
    if (whyMaterial !== undefined) updateData.whyMaterial = whyMaterial || null;
    if (rootCauseStatement !== undefined) updateData.rootCauseStatement = rootCauseStatement || null;
    if (verificationMethod !== undefined) updateData.verificationMethod = verificationMethod || null;
    if (verifiedById !== undefined) updateData.verifiedById = verifiedById || null;
    if (verificationDate !== undefined) updateData.verificationDate = verificationDate ? new Date(verificationDate) : null;
    if (effectivenessOutcome !== undefined) updateData.effectivenessOutcome = effectivenessOutcome || null;
    if (objectiveEvidence !== undefined) updateData.objectiveEvidence = objectiveEvidence || null;
    if (lessonsLearned !== undefined) updateData.lessonsLearned = lessonsLearned || null;
    if (preventiveActions !== undefined) updateData.preventiveActions = preventiveActions || null;
    if (finalDisposition !== undefined) updateData.finalDisposition = finalDisposition || null;
    if (status !== undefined) updateData.status = status;

    // If actions array provided, delete existing and recreate
    if (actions !== undefined) {
      await prisma.cAPAAction.deleteMany({ where: { capaId: id } });

      if (actions.length > 0) {
        await prisma.cAPAAction.createMany({
          data: actions.map(
            (
              a: {
                description: string;
                responsibleParty?: string;
                dueDate?: string;
                status?: string;
              },
              idx: number
            ) => ({
              capaId: id,
              actionNumber: idx + 1,
              description: a.description,
              responsibleParty: a.responsibleParty || null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
              status: a.status || "planned",
            })
          ),
        });
      }
    }

    const capa = await prisma.cAPA.update({
      where: { id },
      data: updateData,
      include: { actions: true },
    });

    return NextResponse.json(capa);
  } catch (error) {
    console.error("[CAPA PUT]", error);
    return NextResponse.json(
      { error: "Failed to update CAPA" },
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

    const existing = await prisma.cAPA.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.cAPA.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CAPA DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete CAPA" },
      { status: 500 }
    );
  }
}
