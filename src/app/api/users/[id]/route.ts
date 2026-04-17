import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Super-admin-only user deletion. We don't want to cascade-delete records the
// user has authored (work orders, projects, NCRs, CAPAs, complaints, logs) —
// those belong to the business, not to the user. So we reassign "creator" /
// "submitter" / "originator" refs to the deleting super admin, null out all
// optional assignments, and remove per-user artifacts (M365 tokens).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only super admins can delete users" },
      { status: 403 },
    );
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isSuperAdmin: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.isSuperAdmin) {
    return NextResponse.json(
      { error: "Super admins cannot be deleted. Revoke super admin first." },
      { status: 400 },
    );
  }

  const deleterId = session.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      // --- Reassign required authorship fields to the deleter ---
      await tx.workOrder.updateMany({
        where: { createdById: id },
        data: { createdById: deleterId },
      });
      await tx.project.updateMany({
        where: { createdById: id },
        data: { createdById: deleterId },
      });
      await tx.maintenanceLog.updateMany({
        where: { userId: id },
        data: { userId: deleterId },
      });
      await tx.nonConformance.updateMany({
        where: { submittedById: id },
        data: { submittedById: deleterId },
      });
      await tx.cAPA.updateMany({
        where: { originatorId: id },
        data: { originatorId: deleterId },
      });
      await tx.customerComplaint.updateMany({
        where: { submittedById: id },
        data: { submittedById: deleterId },
      });

      // --- Null out optional assignment fields across every record type ---
      await tx.equipment.updateMany({
        where: { assignedTechnicianId: id },
        data: { assignedTechnicianId: null },
      });
      await tx.equipment.updateMany({
        where: { secondaryTechnicianId: id },
        data: { secondaryTechnicianId: null },
      });
      await tx.maintenanceSchedule.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.maintenanceSchedule.updateMany({
        where: { secondaryAssignedToId: id },
        data: { secondaryAssignedToId: null },
      });
      await tx.workOrder.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.workOrder.updateMany({
        where: { secondaryAssignedToId: id },
        data: { secondaryAssignedToId: null },
      });
      await tx.workOrder.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      });
      await tx.project.updateMany({
        where: { projectLeadId: id },
        data: { projectLeadId: null },
      });
      await tx.project.updateMany({
        where: { secondaryLeadId: id },
        data: { secondaryLeadId: null },
      });
      await tx.processedMessage.updateMany({
        where: { scannedByUserId: id },
        data: { scannedByUserId: null },
      });
      await tx.aISuggestion.updateMany({
        where: { reviewedBy: id },
        data: { reviewedBy: null },
      });
      await tx.nonConformance.updateMany({
        where: { approvedById: id },
        data: { approvedById: null },
      });
      await tx.nonConformance.updateMany({
        where: { assignedInvestigatorId: id },
        data: { assignedInvestigatorId: null },
      });
      await tx.nonConformance.updateMany({
        where: { secondaryInvestigatorId: id },
        data: { secondaryInvestigatorId: null },
      });
      await tx.cAPA.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.cAPA.updateMany({
        where: { secondaryAssignedToId: id },
        data: { secondaryAssignedToId: null },
      });
      await tx.cAPA.updateMany({
        where: { verifiedById: id },
        data: { verifiedById: null },
      });
      await tx.customerComplaint.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null },
      });
      await tx.customerComplaint.updateMany({
        where: { secondaryAssignedToId: id },
        data: { secondaryAssignedToId: null },
      });

      // --- Remove per-user artifacts that have no meaning without the user ---
      await tx.m365Connection.deleteMany({ where: { connectedBy: id } });
      // Notifications cascade-delete automatically (schema onDelete: Cascade).

      await tx.user.delete({ where: { id } });
    });
  } catch (error) {
    console.error("[User Delete] failed:", error);
    return NextResponse.json(
      { error: "Failed to delete user — one or more records reference them. See server logs." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
