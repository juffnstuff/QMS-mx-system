import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { Shield, Plus } from "lucide-react";
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

export default async function CAPAsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severityLevel?: string }>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  if (params.severityLevel && params.severityLevel !== "all") {
    where.severityLevel = params.severityLevel;
  }

  const capas = await prisma.cAPA.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { originator: true, assignedTo: true, referenceNcr: true, actions: true },
    take: 50,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CAPA Records</h1>
        <Link
          href="/capas/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New CAPA
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="closed">Closed</option>
          </select>
          <select
            name="severityLevel"
            defaultValue={params.severityLevel || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severity Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button
            type="submit"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {capas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No CAPA records found.</p>
            <Link href="/capas/new" className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
              <Plus size={14} /> Create your first CAPA
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {capas.map((capa) => (
              <div key={capa.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <Link href={`/capas/${capa.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {capa.capaNumber}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {sourceLabels[capa.source] || capa.source}
                      {" • "}
                      {capa.originator?.name || "Unknown"}
                      {capa.assignedTo && ` • Assigned: ${capa.assignedTo.name}`}
                    </p>
                    {capa.targetCloseDate && (
                      <p className={`text-xs mt-0.5 ${new Date(capa.targetCloseDate) < new Date() && capa.status !== "closed" ? "text-red-500" : "text-gray-400"}`}>
                        Target Close: {new Date(capa.targetCloseDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={capa.severityLevel} />
                    <StatusBadge status={capa.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
