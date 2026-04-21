import { prisma } from "@/lib/prisma";
import { History, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { StatusEntityType } from "@/lib/status-log";

interface Props {
  entityType: StatusEntityType;
  entityId: string;
  limit?: number;
}

/**
 * Server component that renders a reverse-chronological list of status and
 * boardStatus changes for a single record, with who made the change.
 */
export async function StatusHistory({ entityType, entityId, limit = 20 }: Props) {
  const entries = await prisma.statusChangeLog.findMany({
    where: { entityType, entityId },
    orderBy: { changedAt: "desc" },
    take: limit,
    include: { changedBy: { select: { id: true, name: true } } },
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <History size={16} />
        Status History
        {entries.length > 0 && (
          <span className="text-sm font-normal text-gray-500">({entries.length})</span>
        )}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No status changes logged yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-400 uppercase">
                  {e.field === "boardStatus" ? "Board" : "Status"}
                </span>
                {e.fromValue && (
                  <span className="text-gray-500 capitalize">{e.fromValue.replace(/_/g, " ")}</span>
                )}
                {e.fromValue && <ArrowRight size={12} className="text-gray-300" />}
                <span className="font-medium text-gray-900 capitalize">
                  {e.toValue.replace(/_/g, " ")}
                </span>
                {e.note && <span className="text-xs text-gray-400">({e.note})</span>}
              </div>
              <div className="text-xs text-gray-500 text-right whitespace-nowrap shrink-0">
                <Link
                  href={`/users?highlight=${e.changedBy.id}`}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {e.changedBy.name}
                </Link>
                <p className="text-gray-400">{new Date(e.changedAt).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
