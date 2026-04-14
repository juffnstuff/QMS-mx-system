import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const complaint = await prisma.customerComplaint.findUnique({
      where: { id },
      include: {
        submittedBy: true,
        linkedNcr: true,
        linkedCapa: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("[Complaint GET by ID]", error);
    return NextResponse.json(
      { error: "Failed to fetch complaint" },
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

    const existing = await prisma.customerComplaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const {
      customerName,
      customerAddress,
      customerContact,
      contactPhone,
      contactEmail,
      partNumber,
      salesOrderNumber,
      invoiced,
      invoiceNumber,
      invoiceValue,
      drawingNumber,
      drawingRevision,
      quantityAffected,
      otherInfo,
      complaintType,
      complaintDescription,
      disposition,
      rmaNumber,
      customerFacingAction,
      internalAction,
      ncrRequired,
      capaRequired,
      affectsOtherOrders,
      rootCauseRequired,
      linkedNcrId,
      linkedCapaId,
      status,
      assignedToId,
    } = body;

    const isAdmin = session.user.role === "admin";
    const updateData: Record<string, unknown> = {};

    // General fields
    if (customerName !== undefined) updateData.customerName = customerName;
    if (customerAddress !== undefined) updateData.customerAddress = customerAddress || null;
    if (customerContact !== undefined) updateData.customerContact = customerContact || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null;
    if (partNumber !== undefined) updateData.partNumber = partNumber || null;
    if (salesOrderNumber !== undefined) updateData.salesOrderNumber = salesOrderNumber || null;
    if (invoiced !== undefined) updateData.invoiced = invoiced || null;
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber || null;
    if (invoiceValue !== undefined) updateData.invoiceValue = invoiceValue || null;
    if (drawingNumber !== undefined) updateData.drawingNumber = drawingNumber || null;
    if (drawingRevision !== undefined) updateData.drawingRevision = drawingRevision || null;
    if (quantityAffected !== undefined) updateData.quantityAffected = quantityAffected || null;
    if (otherInfo !== undefined) updateData.otherInfo = otherInfo || null;
    if (complaintType !== undefined) updateData.complaintType = complaintType;
    if (complaintDescription !== undefined) updateData.complaintDescription = complaintDescription;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;

    // Admin-only fields: disposition, status, management fields
    if (isAdmin) {
      if (status !== undefined) updateData.status = status;
      if (disposition !== undefined) updateData.disposition = disposition || null;
      if (rmaNumber !== undefined) updateData.rmaNumber = rmaNumber || null;
      if (customerFacingAction !== undefined) updateData.customerFacingAction = customerFacingAction || null;
      if (internalAction !== undefined) updateData.internalAction = internalAction || null;
      if (ncrRequired !== undefined) updateData.ncrRequired = ncrRequired;
      if (capaRequired !== undefined) updateData.capaRequired = capaRequired;
      if (affectsOtherOrders !== undefined) updateData.affectsOtherOrders = affectsOtherOrders;
      if (rootCauseRequired !== undefined) updateData.rootCauseRequired = rootCauseRequired;
      if (linkedNcrId !== undefined) updateData.linkedNcrId = linkedNcrId || null;
      if (linkedCapaId !== undefined) updateData.linkedCapaId = linkedCapaId || null;
    }

    const complaint = await prisma.customerComplaint.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(complaint);
  } catch (error) {
    console.error("[Complaint PUT]", error);
    return NextResponse.json(
      { error: "Failed to update complaint" },
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

    const existing = await prisma.customerComplaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.customerComplaint.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Complaint DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete complaint" },
      { status: 500 }
    );
  }
}
