import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { NotesSection } from "@/components/notes/notes-section";
import Link from "next/link";

const dispositionLabels: Record<string, string> = {
  return_rework: "Return & Rework",
  return_credit: "Return & Credit",
  return_refund: "Return & Refund",
  replace_no_charge: "Replace No Charge",
  other: "Other",
};

const complaintTypeLabels: Record<string, string> = {
  aesthetic: "Aesthetic",
  dimensional: "Dimensional",
  function: "Function",
  quality: "Quality",
  safety: "Safety",
  compliance: "Compliance",
  packaging: "Packaging",
  shipping_damage: "Shipping Damage",
  other: "Other",
};

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const complaint = await prisma.customerComplaint.findUnique({
    where: { id },
    include: {
      submittedBy: true,
      assignedTo: true,
      secondaryAssignedTo: true,
      linkedNcr: true,
      linkedCapa: true,
    },
  });

  if (!complaint) notFound();

  return (
    <div>
      <Breadcrumbs items={[
        { label: "Complaints", href: "/complaints" },
        { label: complaint.complaintNumber },
      ]} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {complaint.complaintNumber}
            </h1>
            <StatusBadge status={complaint.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {complaint.customerName} {"\u2022"} {complaintTypeLabels[complaint.complaintType] || complaint.complaintType}
          </p>
        </div>
        <div className="shrink-0">
          <DeleteRecordButton
            recordId={id}
            recordType="complaints"
            recordLabel={complaint.complaintNumber}
            redirectTo="/complaints"
          />
        </div>
      </div>

      {/* Complaint Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Complaint Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Customer Name</dt>
            <dd className="text-gray-900">{complaint.customerName}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Complaint Type</dt>
            <dd><StatusBadge status={complaint.complaintType} /></dd>
          </div>
          {complaint.customerAddress && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Customer Address</dt>
              <dd className="text-gray-900">{complaint.customerAddress}</dd>
            </div>
          )}
          {complaint.customerContact && (
            <div>
              <dt className="text-sm text-gray-500">Customer Contact</dt>
              <dd className="text-gray-900">{complaint.customerContact}</dd>
            </div>
          )}
          {complaint.contactPhone && (
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="text-gray-900">{complaint.contactPhone}</dd>
            </div>
          )}
          {complaint.contactEmail && (
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-gray-900">{complaint.contactEmail}</dd>
            </div>
          )}
          {complaint.partNumber && (
            <div>
              <dt className="text-sm text-gray-500">Part # / Part Name</dt>
              <dd className="font-mono text-gray-900">{complaint.partNumber}</dd>
            </div>
          )}
          {complaint.salesOrderNumber && (
            <div>
              <dt className="text-sm text-gray-500">Sales Order #</dt>
              <dd className="font-mono text-gray-900">{complaint.salesOrderNumber}</dd>
            </div>
          )}
          {complaint.invoiced && (
            <div>
              <dt className="text-sm text-gray-500">Invoiced</dt>
              <dd className="text-gray-900 capitalize">{complaint.invoiced}</dd>
            </div>
          )}
          {complaint.invoiceNumber && (
            <div>
              <dt className="text-sm text-gray-500">Invoice #</dt>
              <dd className="font-mono text-gray-900">{complaint.invoiceNumber}</dd>
            </div>
          )}
          {complaint.invoiceValue && (
            <div>
              <dt className="text-sm text-gray-500">Invoice Value</dt>
              <dd className="text-gray-900">{complaint.invoiceValue}</dd>
            </div>
          )}
          {complaint.drawingNumber && (
            <div>
              <dt className="text-sm text-gray-500">Drawing #</dt>
              <dd className="font-mono text-gray-900">{complaint.drawingNumber}</dd>
            </div>
          )}
          {complaint.drawingRevision && (
            <div>
              <dt className="text-sm text-gray-500">Drawing Revision</dt>
              <dd className="text-gray-900">{complaint.drawingRevision}</dd>
            </div>
          )}
          {complaint.quantityAffected && (
            <div>
              <dt className="text-sm text-gray-500">Quantity Affected</dt>
              <dd className="text-gray-900">{complaint.quantityAffected}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Submitted By</dt>
            <dd className="text-gray-900"><Link href={`/users?highlight=${complaint.submittedBy.id}`} className="text-blue-600 hover:text-blue-800">{complaint.submittedBy.name}</Link></dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Assigned To</dt>
            <dd className="text-gray-900">
              {complaint.assignedTo ? (
                <Link href={`/users?highlight=${complaint.assignedTo.id}`} className="text-blue-600 hover:text-blue-800">{complaint.assignedTo.name}</Link>
              ) : <span className="text-gray-400">Unassigned</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Secondary Assignee</dt>
            <dd className="text-gray-900">
              {complaint.secondaryAssignedTo ? (
                <Link href={`/users?highlight=${complaint.secondaryAssignedTo.id}`} className="text-blue-600 hover:text-blue-800">{complaint.secondaryAssignedTo.name}</Link>
              ) : <span className="text-gray-400">None</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Date</dt>
            <dd className="text-gray-900">{new Date(complaint.date).toLocaleDateString()}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-gray-500">Detailed Description</dt>
            <dd className="text-gray-900 whitespace-pre-wrap">{complaint.complaintDescription}</dd>
          </div>
          {complaint.otherInfo && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Other Information</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{complaint.otherInfo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Management Disposition */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Management Disposition</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Recommended Disposition</dt>
            <dd className="text-gray-900">
              {complaint.disposition
                ? dispositionLabels[complaint.disposition] || complaint.disposition
                : "Not yet determined"}
            </dd>
          </div>
          {complaint.rmaNumber && (
            <div>
              <dt className="text-sm text-gray-500">RMA #</dt>
              <dd className="font-mono text-gray-900">{complaint.rmaNumber}</dd>
            </div>
          )}
          {complaint.customerFacingAction && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Customer Facing Action</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{complaint.customerFacingAction}</dd>
            </div>
          )}
          {complaint.internalAction && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-gray-500">Internal Action Required</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{complaint.internalAction}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">NCR Required</dt>
            <dd className="text-gray-900">{complaint.ncrRequired ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">CAPA Required</dt>
            <dd className="text-gray-900">{complaint.capaRequired ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Affects Other Orders</dt>
            <dd className="text-gray-900">{complaint.affectsOtherOrders ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Root Cause Investigation Required</dt>
            <dd className="text-gray-900">{complaint.rootCauseRequired ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </div>

      {/* Linked Records */}
      {(complaint.linkedNcr || complaint.linkedCapa) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Linked Records</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {complaint.linkedNcr && (
              <div>
                <dt className="text-sm text-gray-500">Linked NCR</dt>
                <dd>
                  <Link
                    href={`/ncrs/${complaint.linkedNcr.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {complaint.linkedNcr.ncrNumber}
                  </Link>
                </dd>
              </div>
            )}
            {complaint.linkedCapa && (
              <div>
                <dt className="text-sm text-gray-500">Linked CAPA</dt>
                <dd>
                  <Link
                    href={`/capas/${complaint.linkedCapa.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {complaint.linkedCapa.capaNumber}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="mt-6">
        <NotesSection
          recordType="complaint"
          recordId={id}
          currentUserId={session?.user.id ?? ""}
          isAdmin={session?.user.role === "admin"}
        />
      </div>

      <div className="mt-6">
        <AttachmentsSection
          recordType="complaint"
          recordId={id}
          currentUserId={session?.user.id ?? ""}
          isAdmin={session?.user.role === "admin"}
        />
      </div>
    </div>
  );
}
