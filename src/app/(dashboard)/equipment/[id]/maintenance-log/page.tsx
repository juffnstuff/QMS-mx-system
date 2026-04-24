import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function EquipmentMaintenanceLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [equipment, logs] = await Promise.all([
    prisma.equipment.findUnique({
      where: { id },
      select: { id: true, name: true, serialNumber: true },
    }),
    prisma.maintenanceLog.findMany({
      where: { equipmentId: id },
      orderBy: { performedAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  if (!equipment) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Equipment", href: "/equipment" },
          { label: equipment.name, href: `/equipment/${id}` },
          { label: "Maintenance Log" },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {equipment.name}
            <span className="ml-2 font-mono text-gray-400">{equipment.serialNumber}</span>
          </p>
        </div>
        <Link
          href={`/maintenance/new?equipmentId=${id}`}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Log Maintenance
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No maintenance history recorded for this equipment yet.</p>
            <Link
              href={`/maintenance/new?equipmentId=${id}`}
              className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
            >
              Log the first maintenance event
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
                  <div className="flex-1">
                    <p className="text-gray-900">{log.description}</p>
                    {log.partsUsed && (
                      <p className="text-sm text-gray-500 mt-0.5">Parts: {log.partsUsed}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right text-sm text-gray-500 sm:whitespace-nowrap">
                    <span className="font-medium text-blue-600">{log.user.name}</span>
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
