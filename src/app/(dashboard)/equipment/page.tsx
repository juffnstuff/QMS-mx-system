import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Plus, Search, ShieldAlert, Shield, ShieldCheck, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { MobileCategorySelect } from "@/components/mobile-category-select";

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

// Category definitions: each maps to an array of equipment type keywords (fallback when equipmentClass is unset)
const CATEGORIES = [
  { id: "all", label: "All Equipment", types: null },
  { id: "extruders", label: "Extruders & Production", types: ["Extruder", "Puller", "Cooling Table", "Cross Saw", "Mixer", "Feed System", "Die Cutting", "Bollard", "Granulator"] },
  { id: "presses", label: "Compression Molding", types: ["Press"] },
  { id: "forklifts", label: "Forklifts & Material Handling", types: ["Forklift", "Pallet Jack", "Scissor Lift", "Loading Dock"] },
  { id: "utilities", label: "Utilities & Support", types: ["Boiler", "Furnace", "Air Compressor", "Chiller", "Transformer", "Generator"] },
  { id: "other", label: "Other", types: null }, // catch-all
] as const;

function categorizeEquipment(item: { type: string; equipmentClass: string | null }): string {
  if (item.equipmentClass) return item.equipmentClass;
  for (const cat of CATEGORIES) {
    if (cat.id === "all" || cat.id === "other") continue;
    if (cat.types?.some((t) => item.type.toLowerCase().includes(t.toLowerCase()))) {
      return cat.id;
    }
  }
  return "other";
}

type SortKey = "name" | "type" | "location" | "serialNumber" | "criticality" | "technician" | "status" | "openWos";
type SortDir = "asc" | "desc";

const VALID_SORT_KEYS: SortKey[] = ["name", "type", "location", "serialNumber", "criticality", "technician", "status", "openWos"];

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; category?: string; sortBy?: string; sortDir?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const statusFilter = params.status;
  const searchQuery = params.search;
  const activeCategory = params.category || "all";
  const sortBy: SortKey = VALID_SORT_KEYS.includes(params.sortBy as SortKey)
    ? (params.sortBy as SortKey)
    : "name";
  const sortDir: SortDir = params.sortDir === "desc" ? "desc" : "asc";

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

  const allEquipment = await prisma.equipment.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      assignedTechnician: { select: { id: true, name: true } },
      parent: { select: { id: true, name: true } },
      _count: {
        select: {
          workOrders: { where: { status: { in: ["open", "in_progress"] } } },
        },
      },
    },
  });

  // Compute counts per category
  const categoryCounts: Record<string, number> = { all: allEquipment.length };
  for (const item of allEquipment) {
    const cat = categorizeEquipment(item);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Filter equipment by active tab
  const filtered =
    activeCategory === "all"
      ? allEquipment
      : allEquipment.filter((item) => categorizeEquipment(item) === activeCategory);

  // In-memory sort — supports all columns uniformly, including related fields
  const equipment = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    let av: string | number = "";
    let bv: string | number = "";
    switch (sortBy) {
      case "name":
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
        break;
      case "type":
        av = a.type.toLowerCase();
        bv = b.type.toLowerCase();
        break;
      case "location":
        av = a.location.toLowerCase();
        bv = b.location.toLowerCase();
        break;
      case "serialNumber":
        av = a.serialNumber.toLowerCase();
        bv = b.serialNumber.toLowerCase();
        break;
      case "criticality":
        av = a.criticality;
        bv = b.criticality;
        break;
      case "technician":
        av = a.assignedTechnician?.name.toLowerCase() ?? "";
        bv = b.assignedTechnician?.name.toLowerCase() ?? "";
        break;
      case "status":
        av = a.status;
        bv = b.status;
        break;
      case "openWos":
        av = a._count.workOrders;
        bv = b._count.workOrders;
        break;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  // Group children directly under their parent in the rendered list. We keep
  // the user's column sort: top-level items sort by the chosen column, and
  // each parent's children are slotted in (in their own sort order) right
  // after the parent. Children whose parent isn't visible (filtered/searched
  // out) bubble up to the top level so they don't disappear.
  const visibleIds = new Set(equipment.map((e) => e.id));
  const childrenByParent = new Map<string, typeof equipment>();
  const topLevel: typeof equipment = [];
  for (const item of equipment) {
    if (item.parentId && visibleIds.has(item.parentId)) {
      const list = childrenByParent.get(item.parentId) ?? [];
      list.push(item);
      childrenByParent.set(item.parentId, list);
    } else {
      topLevel.push(item);
    }
  }
  const grouped: Array<(typeof equipment)[number] & { _depth: number }> = [];
  for (const parent of topLevel) {
    grouped.push({ ...parent, _depth: 0 });
    for (const child of childrenByParent.get(parent.id) ?? []) {
      grouped.push({ ...child, _depth: 1 });
    }
  }

  // Build tab href preserving existing search/status/sort params
  function tabHref(categoryId: string) {
    const p = new URLSearchParams();
    if (searchQuery) p.set("search", searchQuery);
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    if (categoryId !== "all") p.set("category", categoryId);
    if (sortBy !== "name") p.set("sortBy", sortBy);
    if (sortDir !== "asc") p.set("sortDir", sortDir);
    const qs = p.toString();
    return `/equipment${qs ? `?${qs}` : ""}`;
  }

  // Build a sort header href — toggles direction if clicking the active column,
  // otherwise switches to the new column with ascending direction.
  function sortHref(key: SortKey) {
    const nextDir: SortDir =
      sortBy === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    const p = new URLSearchParams();
    if (searchQuery) p.set("search", searchQuery);
    if (statusFilter && statusFilter !== "all") p.set("status", statusFilter);
    if (activeCategory !== "all") p.set("category", activeCategory);
    if (key !== "name") p.set("sortBy", key);
    if (nextDir !== "asc") p.set("sortDir", nextDir);
    const qs = p.toString();
    return `/equipment${qs ? `?${qs}` : ""}`;
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const isActive = sortBy === sortKey;
    const Icon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <Link
          href={sortHref(sortKey)}
          className={`inline-flex items-center gap-1 hover:text-gray-700 transition-colors ${
            isActive ? "text-gray-900" : ""
          }`}
          scroll={false}
        >
          {label}
          <Icon size={12} className={isActive ? "" : "opacity-40"} />
        </Link>
      </th>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Equipment Registry</h1>
        <div className="flex items-center gap-3">
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
      </div>

      {/* Search + Status Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <form className="flex flex-col sm:flex-row gap-3">
          <input type="hidden" name="category" value={activeCategory} />
          {sortBy !== "name" && <input type="hidden" name="sortBy" value={sortBy} />}
          {sortDir !== "asc" && <input type="hidden" name="sortDir" value={sortDir} />}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              name="search"
              type="text"
              placeholder="Search equipment across all tabs..."
              defaultValue={searchQuery || ""}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            name="status"
            defaultValue={statusFilter || "all"}
            className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Category Tabs — Desktop */}
      <div className="hidden sm:flex gap-1 mb-4 overflow-x-auto">
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          const isActive = activeCategory === cat.id;
          return (
            <Link
              key={cat.id}
              href={tabHref(cat.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cat.label}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Category Tabs — Mobile dropdown */}
      <div className="sm:hidden mb-4">
        <MobileCategorySelect
          categories={CATEGORIES.map((cat) => ({
            id: cat.id,
            label: cat.label,
            count: categoryCounts[cat.id] || 0,
          }))}
          activeCategory={activeCategory}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader label="Name" sortKey="name" />
                <SortHeader label="Type" sortKey="type" />
                <SortHeader label="Location" sortKey="location" />
                <SortHeader label="Serial #" sortKey="serialNumber" />
                <SortHeader label="Criticality" sortKey="criticality" />
                <SortHeader label="Technician" sortKey="technician" />
                <SortHeader label="Status" sortKey="status" />
                <SortHeader label="Open WOs" sortKey="openWos" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    item._depth > 0 ? "bg-gray-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center"
                      style={{ paddingLeft: item._depth * 24 }}
                    >
                      {item._depth > 0 && (
                        <span className="text-gray-400 mr-2 select-none">↳</span>
                      )}
                      <Link
                        href={`/equipment/${item.id}`}
                        className={`hover:text-blue-800 ${
                          item._depth > 0
                            ? "text-gray-700"
                            : "text-blue-600 font-medium"
                        }`}
                      >
                        {item.name}
                      </Link>
                    </div>
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
          {grouped.map((item) => (
            <Link
              key={item.id}
              href={`/equipment/${item.id}`}
              className={`block p-4 hover:bg-gray-50 ${
                item._depth > 0 ? "bg-gray-50/50" : ""
              }`}
              style={{ paddingLeft: 16 + item._depth * 20 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {item._depth > 0 && (
                      <span className="text-gray-400 mr-1">↳</span>
                    )}
                    {item.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {item.type} • {item.location}
                  </p>
                  {item.assignedTechnician && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tech: {item.assignedTechnician.name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <CriticalityBadge criticality={item.criticality} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {grouped.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No equipment found{activeCategory !== "all" ? " in this category" : ""}.</p>
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
