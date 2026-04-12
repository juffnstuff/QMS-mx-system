import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const complaintType = searchParams.get("complaintType");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (complaintType && complaintType !== "all") {
      where.complaintType = complaintType;
    }

    const complaints = await prisma.customerComplaint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { submittedBy: true },
      take: 50,
    });

    return NextResponse.json(complaints);
  } catch (error) {
    console.error("[Complaint GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch complaints" },
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
    } = body;

    if (!customerName || !complaintType || !complaintDescription) {
      return NextResponse.json(
        { error: "Customer name, complaint type, and complaint description are required" },
        { status: 400 }
      );
    }

    // Auto-generate complaintNumber: CC-YYYY-001
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const count = await prisma.customerComplaint.count({
      where: {
        createdAt: {
          gte: startOfYear,
          lt: endOfYear,
        },
      },
    });

    const complaintNumber = `CC-${year}-${String(count + 1).padStart(3, "0")}`;

    const complaint = await prisma.customerComplaint.create({
      data: {
        complaintNumber,
        submittedById: session.user.id,
        date: new Date(),
        customerName,
        customerAddress: customerAddress || null,
        customerContact: customerContact || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        partNumber: partNumber || null,
        salesOrderNumber: salesOrderNumber || null,
        invoiced: invoiced || null,
        invoiceNumber: invoiceNumber || null,
        invoiceValue: invoiceValue || null,
        drawingNumber: drawingNumber || null,
        drawingRevision: drawingRevision || null,
        quantityAffected: quantityAffected || null,
        otherInfo: otherInfo || null,
        complaintType,
        complaintDescription,
        disposition: disposition || null,
        rmaNumber: rmaNumber || null,
        customerFacingAction: customerFacingAction || null,
        internalAction: internalAction || null,
        ncrRequired: ncrRequired || false,
        capaRequired: capaRequired || false,
        affectsOtherOrders: affectsOtherOrders || false,
        rootCauseRequired: rootCauseRequired || false,
        status: "open",
      },
    });

    return NextResponse.json(complaint, { status: 201 });
  } catch (error) {
    console.error("[Complaint POST]", error);
    return NextResponse.json(
      { error: "Failed to create complaint" },
      { status: 500 }
    );
  }
}
