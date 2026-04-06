import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

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
      { name: { contains: searchQuery } },
      { type: { contains: searchQuery } },
      { location: { contains: searchQuery } },
      { serialNumber: { contains: searchQuery } },
    ];
  }

  const equipment = await prisma.equipment.findMany({
    where,
    orderBy: { name: "asc" },
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
                  Status
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
                    <StatusBadge status={item.status} />
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
                <StatusBadge status={item.status} />
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
