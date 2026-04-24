import { prisma } from "@/lib/prisma";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";

export default async function MaintenancePage() {
  const logs = await prisma.maintenanceLog.findMany({
    orderBy: { performedAt: "desc" },
    include: { equipment: true, user: true },
    take: 50,
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Log</h1>
        <Link
          href="/maintenance/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Log Maintenance
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No maintenance events logged yet.</p>
            <Link href="/maintenance/new" className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
              Log your first maintenance event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <Link
                key={log.id}
                href={`/maintenance/${log.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-600">
                        {log.equipment.name}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
                    {log.partsUsed && (
                      <p className="text-sm text-gray-400 mt-0.5">Parts: {log.partsUsed}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right text-sm text-gray-500 whitespace-nowrap">
                    <p className="font-medium">{log.user.name}</p>
                    <p>{new Date(log.performedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
