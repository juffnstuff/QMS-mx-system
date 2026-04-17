import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SuggestionCard } from "@/components/m365/suggestion-card";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const statusFilter = params.status || "pending";
  const page = parseInt(params.page || "1");
  const limit = 20;

  const where = statusFilter === "all" ? {} : { status: statusFilter };

  const [suggestions, total, equipment] = await Promise.all([
    prisma.aISuggestion.findMany({
      where,
      select: {
        id: true,
        suggestionType: true,
        kind: true,
        proposedFields: true,
        status: true,
        payload: true,
        createdRecordType: true,
        createdRecordId: true,
        reviewedAt: true,
        reviewNote: true,
        createdAt: true,
        processedMessage: {
          select: {
            subject: true,
            senderName: true,
            senderEmail: true,
            bodyPreview: true,
            sourceType: true,
            receivedAt: true,
            confidence: true,
          },
        },
        reviewer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.aISuggestion.count({ where }),
    prisma.equipment.findMany({
      select: { id: true, name: true, serialNumber: true, location: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/settings/m365" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Connector
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">AI Suggestions</h1>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {["pending", "approved", "rejected", "auto_applied", "all"].map((s) => (
          <Link
            key={s}
            href={`/settings/m365/suggestions?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "auto_applied" ? "Auto-applied" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No {statusFilter !== "all" ? statusFilter : ""} suggestions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              equipment={equipment}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/settings/m365/suggestions?status=${statusFilter}&page=${p}`}
              className={`px-3 py-1 rounded text-sm ${
                page === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
