import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";

const sourceLabels: Record<string, string> = {
  internal_audit: "Internal Audit",
  customer_complaint: "Customer Complaint",
  supplier_issue: "Supplier Issue",
  process_failure: "Process Failure",
  product_defect: "Product Defect",
  management_review: "Management Review",
  regulatory_finding: "Regulatory Finding",
  other: "Other",
};

const rcaMethodLabels: Record<string, string> = {
  "5_whys": "5 Whys",
  fishbone: "Fishbone (Ishikawa)",
  "8d": "8D",
  fault_tree: "Fault Tree Analysis",
  pareto: "Pareto Analysis",
  fmea: "FMEA",
  other: "Other",
};

const effectivenessLabels: Record<string, string> = {
  effective: "Effective",
  partially_effective: "Partially Effective",
  ineffective: "Ineffective",
};

const dispositionLabels: Record<string, string> = {
  closed_effective: "Closed — Effective",
  closed_partial_monitor: "Closed — Partial, Monitor",
  reopened: "Reopened",
  escalated: "Escalated",
};

const actionStatusLabels: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  complete: "Complete",
  verified: "Verified",
};

export default async function CAPADetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const capa = await prisma.cAPA.findUnique({
    where: { id },
    include: {
      originator: true,
      assignedTo: true,
      secondaryAssignedTo: true,
      referenceNcr: true,
      verifiedBy: true,
      actions: { orderBy: { actionNumber: "asc" } },
    },
  });

  if (!capa) notFound();

  return (
    <div>
      <Breadcrumbs items={[
        { label: "CAPAs", href: "/capas" },
        { label: capa.capaNumber },
      ]} />
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{capa.capaNumber}</h1>
            <StatusBadge status={capa.severityLevel} />
            <StatusBadge status={capa.status} />
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Originated by {capa.originator ? (
              <Link href={`/users?highlight=${capa.originator.id}`} className="text-blue-600 hover:text-blue-800">{capa.originator.name}</Link>
            ) : "Unknown"} • {new Date(capa.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1 — Identification */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Section 1 — Identification</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Department / Process / Area</dt>
              <dd className="text-gray-900">{capa.department || "Not specified"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Reference NCR</dt>
              <dd>
                {capa.referenceNcr ? (
                  <Link href={`/ncrs/${capa.referenceNcr.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                    {capa.referenceNcr.ncrNumber}
                  </Link>
                ) : (
                  <span className="text-gray-900">None</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Source of Nonconformance</dt>
              <dd className="text-gray-900">
                {sourceLabels[capa.source] || capa.source}
                {capa.sourceOther ? ` — ${capa.sourceOther}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Severity Level</dt>
              <dd><StatusBadge status={capa.severityLevel} /></dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Assigned To</dt>
              <dd className="text-gray-900">{capa.assignedTo ? (
                <Link href={`/users?highlight=${capa.assignedTo.id}`} className="text-blue-600 hover:text-blue-800">{capa.assignedTo.name}</Link>
              ) : "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Secondary Responsible</dt>
              <dd className="text-gray-900">{capa.secondaryAssignedTo ? (
                <Link href={`/users?highlight=${capa.secondaryAssignedTo.id}`} className="text-blue-600 hover:text-blue-800">{capa.secondaryAssignedTo.name}</Link>
              ) : <span className="text-gray-400">None</span>}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Target Close Date</dt>
              <dd className={`text-sm ${capa.targetCloseDate && new Date(capa.targetCloseDate) < new Date() && capa.status !== "closed" ? "text-red-600 font-medium" : "text-gray-900"}`}>
                {capa.targetCloseDate
                  ? new Date(capa.targetCloseDate).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Section 2 — Problem Description */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Section 2 — Problem Description</h2>
          <div className="space-y-4">
            <div>
              <dt className="text-sm text-gray-500 mb-1">Nonconformance Description</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">{capa.nonconformanceDescription}</dd>
            </div>
            {capa.productProcessAffected && (
              <div>
                <dt className="text-sm text-gray-500 mb-1">Product / Process / Service Affected</dt>
                <dd className="text-gray-900">{capa.productProcessAffected}</dd>
              </div>
            )}
            {capa.quantityScopeAffected && (
              <div>
                <dt className="text-sm text-gray-500 mb-1">Quantity / Scope Affected</dt>
                <dd className="text-gray-900">{capa.quantityScopeAffected}</dd>
              </div>
            )}
            {capa.containmentActions && (
              <div>
                <dt className="text-sm text-gray-500 mb-1">Immediate Containment Actions</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">{capa.containmentActions}</dd>
              </div>
            )}
          </div>
        </div>

        {/* Section 3 — Root Cause Analysis */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Section 3 — Root Cause Analysis</h2>
          <div className="space-y-4">
            {capa.rcaMethod && (
              <div>
                <dt className="text-sm text-gray-500 mb-1">RCA Method Used</dt>
                <dd className="text-gray-900">
                  {rcaMethodLabels[capa.rcaMethod] || capa.rcaMethod}
                  {capa.rcaMethodOther ? ` — ${capa.rcaMethodOther}` : ""}
                </dd>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {capa.whyMan && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Man / Human Factors</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.whyMan}</dd>
                </div>
              )}
              {capa.whyMachine && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Machine / Equipment</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.whyMachine}</dd>
                </div>
              )}
              {capa.whyMethod && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Method / Process</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.whyMethod}</dd>
                </div>
              )}
              {capa.whyMaterial && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Material</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.whyMaterial}</dd>
                </div>
              )}
            </div>
            {capa.rootCauseStatement && (
              <div>
                <dt className="text-sm text-gray-500 mb-1">Verified Root Cause Statement</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">{capa.rootCauseStatement}</dd>
              </div>
            )}
          </div>
        </div>

        {/* Section 4 — Corrective Action Plan */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Section 4 — Corrective Action Plan</h2>
          {capa.actions.length === 0 ? (
            <p className="text-gray-500 text-sm">No action items defined.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">#</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Description</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Responsible</th>
                    <th className="text-left py-2 pr-4 text-gray-500 font-medium">Due Date</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {capa.actions.map((action) => (
                    <tr key={action.id}>
                      <td className="py-2 pr-4 text-gray-900">{action.actionNumber}</td>
                      <td className="py-2 pr-4 text-gray-900">{action.description}</td>
                      <td className="py-2 pr-4 text-gray-900">{action.responsibleParty || "—"}</td>
                      <td className="py-2 pr-4 text-gray-900">
                        {action.dueDate ? new Date(action.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2">
                        <StatusBadge status={action.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 5 — Effectiveness Verification */}
        {(capa.verificationMethod || capa.effectivenessOutcome || capa.objectiveEvidence || capa.lessonsLearned || capa.preventiveActions || capa.finalDisposition) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Section 5 — Effectiveness Verification</h2>
            <div className="space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {capa.verificationMethod && (
                  <div>
                    <dt className="text-sm text-gray-500">Verification Method</dt>
                    <dd className="text-gray-900">{capa.verificationMethod}</dd>
                  </div>
                )}
                {capa.verifiedBy && (
                  <div>
                    <dt className="text-sm text-gray-500">Verified By</dt>
                    <dd className="text-gray-900"><Link href={`/users?highlight=${capa.verifiedBy.id}`} className="text-blue-600 hover:text-blue-800">{capa.verifiedBy.name}</Link></dd>
                  </div>
                )}
                {capa.verificationDate && (
                  <div>
                    <dt className="text-sm text-gray-500">Verification Date</dt>
                    <dd className="text-gray-900">{new Date(capa.verificationDate).toLocaleDateString()}</dd>
                  </div>
                )}
                {capa.effectivenessOutcome && (
                  <div>
                    <dt className="text-sm text-gray-500">Effectiveness Outcome</dt>
                    <dd className="text-gray-900">{effectivenessLabels[capa.effectivenessOutcome] || capa.effectivenessOutcome}</dd>
                  </div>
                )}
                {capa.finalDisposition && (
                  <div>
                    <dt className="text-sm text-gray-500">Final Disposition</dt>
                    <dd className="text-gray-900">{dispositionLabels[capa.finalDisposition] || capa.finalDisposition}</dd>
                  </div>
                )}
              </dl>
              {capa.objectiveEvidence && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Objective Evidence</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.objectiveEvidence}</dd>
                </div>
              )}
              {capa.lessonsLearned && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Lessons Learned</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.lessonsLearned}</dd>
                </div>
              )}
              {capa.preventiveActions && (
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Preventive Actions / System Updates</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">{capa.preventiveActions}</dd>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
