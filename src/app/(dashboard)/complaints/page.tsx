import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { MessageSquareWarning, Plus } from "lucide-react";
import Link from "next/link";

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; complaintType?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }
  if (params.complaintType && params.complaintType !== "all") {
    where.complaintType = params.complaintType;
  }

  const complaints = await prisma.customerComplaint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { submittedBy: true, assignedTo: true },
    take: 50,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer Complaints</h1>
        <Link
          href="/complaints/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Complaint
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
            <option value="investigating">Investigating</option>
            <option value="dispositioned">Dispositioned</option>
            <option value="closed">Closed</option>
          </select>
          <select
            name="complaintType"
            defaultValue={params.complaintType || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Complaint Types</option>
            <option value="aesthetic">Aesthetic</option>
            <option value="dimensional">Dimensional</option>
            <option value="function">Function</option>
            <option value="quality">Quality</option>
            <option value="safety">Safety</option>
            <option value="compliance">Compliance</option>
            <option value="packaging">Packaging</option>
            <option value="shipping_damage">Shipping Damage</option>
            <option value="other">Other</option>
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
        {complaints.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquareWarning size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No customer complaints found.</p>
            <Link href="/complaints/new" className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
              <Plus size={14} /> Submit your first complaint
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <Link href={`/complaints/${complaint.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {complaint.complaintNumber}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {complaint.customerName}
                      {" \u2022 "}
                      Submitted by {complaint.submittedBy.name}
                      {complaint.assignedTo && ` \u2022 Assigned: ${complaint.assignedTo.name}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(complaint.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <StatusBadge status={complaint.complaintType} />
                    <StatusBadge status={complaint.status} />
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
