import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";

export default async function NCRsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ncrType?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  if (params.ncrType && params.ncrType !== "all") {
    where.ncrType = params.ncrType;
  }

  const ncrs = await prisma.nonConformance.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { submittedBy: true, approvedBy: true, assignedInvestigator: true },
    take: 50,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Non-Conformance Reports</h1>
        <Link
          href="/ncrs/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New NCR
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <select
            name="status"
            defaultValue={params.status || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="dispositioned">Dispositioned</option>
            <option value="closed">Closed</option>
          </select>
          <select
            name="ncrType"
            defaultValue={params.ncrType || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All NCR Types</option>
            <option value="aesthetic">Aesthetic</option>
            <option value="dimensional">Dimensional</option>
            <option value="function">Function</option>
            <option value="quality">Quality</option>
            <option value="safety">Safety</option>
            <option value="compliance">Compliance</option>
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
        {ncrs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No non-conformance reports found.</p>
            <Link href="/ncrs/new" className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
              <Plus size={14} /> Create your first NCR
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {ncrs.map((ncr) => (
              <div key={ncr.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <Link href={`/ncrs/${ncr.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {ncr.ncrNumber}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {ncr.partNumber || "No part number"}
                      {" \u2022 "}
                      Submitted by {ncr.submittedBy.name}
                      {ncr.assignedInvestigator && ` \u2022 Investigator: ${ncr.assignedInvestigator.name}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ncr.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={ncr.ncrType} />
                    <StatusBadge status={ncr.status} />
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
