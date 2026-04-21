import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { NCRStatusUpdate } from "@/components/ncr-status-update";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DeleteRecordButton } from "@/components/delete-record-button";
import { AttachmentsSection } from "@/components/attachments/attachments-section";
import { StatusHistory } from "@/components/status-history";
import Link from "next/link";

const dispositionLabels: Record<string, string> = {
  rework: "Re-Work",
  return_to_vendor: "Return to Vendor",
  scrap: "Scrap",
  use_as_is: "Use As Is",
};

const ncrTypeLabels: Record<string, string> = {
  aesthetic: "Aesthetic",
  dimensional: "Dimensional",
  function: "Function",
  quality: "Quality",
  safety: "Safety",
  compliance: "Compliance",
};

export default async function NCRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const ncr = await prisma.nonConformance.findUnique({
    where: { id },
    include: {
      submittedBy: true,
      approvedBy: true,
      assignedInvestigator: true,
      secondaryInvestigator: true,
    },
  });

  if (!ncr) notFound();

  const isAdmin = session?.user.role === "admin";

  return (
    <div>
      <Breadcrumbs items={[
        { label: "NCRs", href: "/ncrs" },
        { label: ncr.ncrNumber },
      ]} />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{ncr.ncrNumber}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Non-Conformance Report</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ncr.ncrType} />
          <StatusBadge status={ncr.status} />
          {isAdmin && (
            <DeleteRecordButton
              recordId={id}
              recordType="ncrs"
              recordLabel={ncr.ncrNumber}
              redirectTo="/ncrs"
              compact
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Requirement / Specification</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{ncr.requirementDescription}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Non-Conformance Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{ncr.nonConformanceDescription}</p>
          </div>

          {ncr.immediateAction && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-3">Immediate Action</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{ncr.immediateAction}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Update Status & Disposition</h2>
            <NCRStatusUpdate
              ncrId={ncr.id}
              currentStatus={ncr.status}
              currentDisposition={ncr.disposition}
            />
          </div>

          <AttachmentsSection
            recordType="ncr"
            recordId={id}
            currentUserId={session?.user.id ?? ""}
            isAdmin={isAdmin}
          />

          <StatusHistory entityType="nonConformance" entityId={id} />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500 uppercase">NCR Number</dt>
                <dd className="text-sm text-gray-900">{ncr.ncrNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Status</dt>
                <dd><StatusBadge status={ncr.status} /></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">NCR Type</dt>
                <dd><StatusBadge status={ncr.ncrType} /></dd>
              </div>
              {ncr.partNumber && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Part # / Process</dt>
                  <dd className="text-sm text-gray-900">{ncr.partNumber}</dd>
                </div>
              )}
              {ncr.drawingNumber && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Drawing #</dt>
                  <dd className="text-sm text-gray-900">
                    {ncr.drawingNumber}
                    {ncr.drawingRevision && ` Rev ${ncr.drawingRevision}`}
                  </dd>
                </div>
              )}
              {ncr.quantityAffected && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Qty Affected</dt>
                  <dd className="text-sm text-gray-900">{ncr.quantityAffected}</dd>
                </div>
              )}
              {ncr.vendor && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Vendor</dt>
                  <dd className="text-sm text-gray-900">{ncr.vendor}</dd>
                </div>
              )}
              {ncr.otherInfo && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Other Info</dt>
                  <dd className="text-sm text-gray-900">{ncr.otherInfo}</dd>
                </div>
              )}
              {ncr.disposition && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Disposition</dt>
                  <dd className="text-sm text-gray-900">{dispositionLabels[ncr.disposition] || ncr.disposition}</dd>
                </div>
              )}
              {ncr.ncrTagNumber && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">NCR Tag #</dt>
                  <dd className="text-sm text-gray-900">{ncr.ncrTagNumber}</dd>
                </div>
              )}
              {ncr.plantLocation && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Plant Location</dt>
                  <dd className="text-sm text-gray-900">{ncr.plantLocation}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500 uppercase">Submitted By</dt>
                <dd className="text-sm"><Link href={`/users?highlight=${ncr.submittedBy.id}`} className="text-blue-600 hover:text-blue-800">{ncr.submittedBy.name}</Link></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Assigned Investigator</dt>
                <dd className="text-sm">
                  {ncr.assignedInvestigator ? (
                    <Link href={`/users?highlight=${ncr.assignedInvestigator.id}`} className="text-blue-600 hover:text-blue-800">{ncr.assignedInvestigator.name}</Link>
                  ) : <span className="text-gray-400">Unassigned</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Secondary Investigator</dt>
                <dd className="text-sm">
                  {ncr.secondaryInvestigator ? (
                    <Link href={`/users?highlight=${ncr.secondaryInvestigator.id}`} className="text-blue-600 hover:text-blue-800">{ncr.secondaryInvestigator.name}</Link>
                  ) : <span className="text-gray-400">None</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 uppercase">Date</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(ncr.date).toLocaleDateString()}
                </dd>
              </div>
              {ncr.approvedBy && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Approved By</dt>
                  <dd className="text-sm"><Link href={`/users?highlight=${ncr.approvedBy.id}`} className="text-blue-600 hover:text-blue-800">{ncr.approvedBy.name}</Link></dd>
                </div>
              )}
              {ncr.approvedAt && (
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Approved At</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(ncr.approvedAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
