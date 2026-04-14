import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Plus, Search, ShieldAlert, Shield, ShieldCheck } from "lucide-react";

function CriticalityBadge({ criticality }: { criticality: string }) {
  const config: Record<string, { label: string; bg: string; text: string; icon: typeof ShieldAlert }> = {
    A: { label: "Class A", bg: "bg-red-100", text: "text-red-800", icon: ShieldAlert },
    B: { label: "Class B", bg: "bg-amber-100", text: "text-amber-800", icon: Shield },
    C: { label: "Class C", bg: "bg-green-100", text: "text-green-800", icon: ShieldCheck },
  };
  const c = config[criticality] || config.C;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const statusFilter = params.status;
  const searchQuery = params.search;

  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }
  if (searchQuery) {
    where.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { type: { contains: searchQuery, mode: "insensitive" } },
      { location: { contains: searchQuery, mode: "insensitive" } },
      { serialNumber: { contains: searchQuery, mode: "insensitive" } },
      { groupName: { contains: searchQuery, mode: "insensitive" } },
      { notes: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const equipment = await prisma.equipment.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      assignedTechnician: { select: { id: true, name: true } },
      _count: {
        select: {
          workOrders: { where: { status: { in: ["open", "in_progress"] } } },
        },
      },
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Equipment Registry</h1>
        {session?.user.role === "admin" && (
          <Link
            href="/equipment/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Add Equipment
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              name="search"
              type="text"
              placeholder="Search equipment..."
              defaultValue={searchQuery || ""}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            name="status"
            defaultValue={statusFilter || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="operational">Operational</option>
            <option value="needs_service">Needs Service</option>
            <option value="down">Down</option>
          </select>
          <button
            type="submit"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serial #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criticality
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Technician
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open WOs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equipment.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/equipment/${item.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.location}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {item.serialNumber}
                  </td>
                  <td className="px-4 py-3">
                    <CriticalityBadge criticality={item.criticality} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.assignedTechnician?.name || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    {item._count.workOrders > 0 ? (
                      <Link
                        href={`/work-orders?equipmentId=${item.id}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                      >
                        {item._count.workOrders}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {equipment.map((item) => (
            <Link
              key={item.id}
              href={`/equipment/${item.id}`}
              className="block p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {item.type} • {item.location}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {item.serialNumber}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <CriticalityBadge criticality={item.criticality} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {equipment.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No equipment found.</p>
            {session?.user.role === "admin" && (
              <Link
                href="/equipment/new"
                className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
              >
                Add your first piece of equipment
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
