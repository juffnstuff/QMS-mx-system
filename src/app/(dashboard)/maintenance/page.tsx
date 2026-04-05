import { prisma } from "@/lib/prisma";
import { FileText } from "lucide-react";

export default async function MaintenancePage() {
  const logs = await prisma.maintenanceLog.findMany({
    orderBy: { performedAt: "desc" },
    include: { equipment: true, user: true },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Maintenance Log</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No maintenance events logged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{log.equipment.name}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>
                    {log.partsUsed && (
                      <p className="text-sm text-gray-400 mt-0.5">Parts: {log.partsUsed}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right text-sm text-gray-500 whitespace-nowrap">
                    <p>{log.user.name}</p>
                    <p>{new Date(log.performedAt).toLocaleDateString()}</p>
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
