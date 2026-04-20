import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Mail,
  Smartphone,
  ArrowLeft,
  Wrench,
  ClipboardList,
  Calendar,
  FileText,
  AlertOctagon,
  FileWarning,
  MessageSquare,
  FolderKanban,
  Plus,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { UserNotificationsEditor } from "@/components/user-notifications-editor";
import { UserProfileEditor } from "@/components/user-profile-editor";
import { UserRoleToggle } from "@/components/user-role-toggle";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { DeleteUserButton } from "@/components/delete-user-button";
import { User as UserIcon } from "lucide-react";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/");
  const isSuperAdmin = session.user.isSuperAdmin;

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      assignedEquipment: {
        select: { id: true, name: true, serialNumber: true, status: true, criticality: true },
        orderBy: { name: "asc" },
      },
      secondaryEquipment: {
        select: { id: true, name: true, serialNumber: true, status: true, criticality: true },
        orderBy: { name: "asc" },
      },
      assignedSchedules: {
        select: { id: true, title: true, frequency: true, nextDue: true, boardStatus: true },
        orderBy: { nextDue: "asc" },
      },
      secondarySchedules: {
        select: { id: true, title: true, frequency: true, nextDue: true, boardStatus: true },
        orderBy: { nextDue: "asc" },
      },
      assignedOrders: {
        select: { id: true, title: true, status: true, priority: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      secondaryOrders: {
        select: { id: true, title: true, status: true, priority: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      createdOrders: {
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      maintenanceLogs: {
        select: {
          id: true,
          description: true,
          createdAt: true,
          equipment: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      ledProjects: {
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
      secondaryProjects: {
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
      createdProjects: {
        select: { id: true, title: true, status: true, priority: true, dueDate: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      submittedNCRs: {
        select: { id: true, ncrNumber: true, status: true, createdAt: true, partNumber: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      investigatedNCRs: {
        select: { id: true, ncrNumber: true, status: true, createdAt: true, partNumber: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      secondaryNCRs: {
        select: { id: true, ncrNumber: true, status: true, createdAt: true, partNumber: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      originatedCAPAs: {
        select: { id: true, capaNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      assignedCAPAs: {
        select: { id: true, capaNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      submittedComplaints: {
        select: { id: true, complaintNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      assignedComplaints: {
        select: { id: true, complaintNumber: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });

  if (!user) notFound();

  // Combined helpers: dedupe primary + secondary so a user isn't double-counted
  // when they're both primary and secondary on the same record.
  function dedupe<T extends { id: string }>(...lists: T[][]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const list of lists) {
      for (const item of list) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }

  const equipment = dedupe(user.assignedEquipment, user.secondaryEquipment);
  const schedules = dedupe(user.assignedSchedules, user.secondarySchedules);
  const workOrders = dedupe(user.assignedOrders, user.secondaryOrders);
  const ncrs = dedupe(user.investigatedNCRs, user.secondaryNCRs, user.submittedNCRs);
  const capas = dedupe(user.assignedCAPAs, user.originatedCAPAs);
  const complaints = dedupe(user.assignedComplaints, user.submittedComplaints);
  const projects = dedupe(user.ledProjects, user.secondaryProjects, user.createdProjects);

  const sectionClass =
    "bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6 scroll-mt-20";
  const sectionHeader = "flex items-center justify-between mb-3 gap-2 flex-wrap";
  const sectionTitle = "font-semibold text-gray-900 inline-flex items-center gap-2";
  const addBtn =
    "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/users"
          className="text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
          aria-label="Back to users"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{user.name}</h1>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-700 text-white flex items-center justify-center font-semibold shrink-0">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              {user.phone && (
                <p className="text-xs text-gray-500">
                  {user.phone}
                  {user.carrier ? ` · ${user.carrier}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                user.isSuperAdmin
                  ? "bg-amber-100 text-amber-800"
                  : user.role === "admin"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-blue-100 text-blue-800"
              }`}
            >
              <Shield size={12} />
              {user.isSuperAdmin ? "Super Admin" : user.role === "admin" ? "Admin" : "Operator"}
            </span>
            {user.notifyEmail && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-50 text-green-700">
                <Mail size={12} />
                Email
              </span>
            )}
            {user.notifySMS && user.phone && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-50 text-green-700">
                <Smartphone size={12} />
                SMS
              </span>
            )}
            <span className="text-xs text-gray-400">
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t border-gray-100">
          <UserRoleToggle userId={user.id} userName={user.name} currentRole={user.role} />
          <ResetPasswordButton userId={user.id} userName={user.name} />
          {isSuperAdmin && !user.isSuperAdmin && user.id !== session.user.id && (
            <DeleteUserButton userId={user.id} userName={user.name} />
          )}
        </div>
      </div>

      {/* Profile editor */}
      <div id="profile" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <UserIcon size={16} /> Profile
          </h2>
        </div>
        <UserProfileEditor
          userId={user.id}
          initial={{
            firstName: user.firstName ?? user.name.split(" ")[0] ?? "",
            lastName: user.lastName ?? user.name.split(" ").slice(1).join(" ") ?? "",
            email: user.email,
          }}
        />
      </div>

      {/* Notifications editor */}
      <div id="notifications" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Mail size={16} /> Notification Preferences
          </h2>
        </div>
        <UserNotificationsEditor
          userId={user.id}
          initial={{
            phone: user.phone,
            carrier: user.carrier,
            notifyEmail: user.notifyEmail,
            notifySMS: user.notifySMS,
          }}
        />
      </div>

      {/* Equipment */}
      <div id="equipment" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Wrench size={16} /> Equipment ({equipment.length})
          </h2>
          <Link href="/equipment/new" className={addBtn}>
            <Plus size={12} /> Assign to new equipment
          </Link>
        </div>
        {equipment.length === 0 ? (
          <p className="text-sm text-gray-500">No equipment assigned.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {equipment.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/equipment/${e.id}`} className="text-blue-600 hover:text-blue-800 font-medium truncate">
                  {e.name}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500 font-mono">{e.serialNumber}</span>
                  <StatusBadge status={e.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Schedules */}
      <div id="schedules" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <Calendar size={16} /> Maintenance Schedules ({schedules.length})
          </h2>
          <Link href="/schedules/new" className={addBtn}>
            <Plus size={12} /> Assign to new schedule
          </Link>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-gray-500">No schedules assigned.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {schedules.map((s) => {
              const overdue = new Date(s.nextDue) < new Date();
              return (
                <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                  <Link href={`/schedules/${s.id}`} className="text-blue-600 hover:text-blue-800 font-medium truncate">
                    {s.title}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 capitalize">{s.frequency}</span>
                    <span className={`text-xs ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      {overdue ? "Overdue " : "Due "} {new Date(s.nextDue).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Work Orders */}
      <div id="work-orders" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <ClipboardList size={16} /> Work Orders ({workOrders.length})
          </h2>
          <Link href="/work-orders/new" className={addBtn}>
            <Plus size={12} /> Assign to new work order
          </Link>
        </div>
        {workOrders.length === 0 ? (
          <p className="text-sm text-gray-500">No work orders assigned.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {workOrders.map((w) => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/work-orders/${w.id}`} className="text-blue-600 hover:text-blue-800 font-medium truncate">
                  {w.title}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={w.priority} />
                  <StatusBadge status={w.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Maintenance Logs */}
      <div id="maintenance-logs" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <FileText size={16} /> Maintenance Logs ({user.maintenanceLogs.length})
          </h2>
          <Link href="/maintenance/new" className={addBtn}>
            <Plus size={12} /> Log maintenance
          </Link>
        </div>
        {user.maintenanceLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No maintenance logs yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {user.maintenanceLogs.map((log) => (
              <li key={log.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/equipment/${log.equipment.id}/maintenance-log`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {log.equipment.name}
                  </Link>
                  <p className="text-xs text-gray-500 line-clamp-1">{log.description}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Projects */}
      <div id="projects" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <FolderKanban size={16} /> Projects ({projects.length})
          </h2>
          <Link href="/projects/new" className={addBtn}>
            <Plus size={12} /> Assign to new project
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">No projects.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {projects.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/projects/${p.id}`} className="text-blue-600 hover:text-blue-800 font-medium truncate">
                  {p.title}
                </Link>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* NCRs */}
      <div id="ncrs" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <AlertOctagon size={16} /> NCRs ({ncrs.length})
          </h2>
          <Link href="/ncrs/new" className={addBtn}>
            <Plus size={12} /> New NCR
          </Link>
        </div>
        {ncrs.length === 0 ? (
          <p className="text-sm text-gray-500">No NCRs.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ncrs.map((n) => (
              <li key={n.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/ncrs/${n.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  {n.ncrNumber} {n.partNumber ? `· ${n.partNumber}` : ""}
                </Link>
                <StatusBadge status={n.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CAPAs */}
      <div id="capas" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <FileWarning size={16} /> CAPAs ({capas.length})
          </h2>
          <Link href="/capas/new" className={addBtn}>
            <Plus size={12} /> New CAPA
          </Link>
        </div>
        {capas.length === 0 ? (
          <p className="text-sm text-gray-500">No CAPAs.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {capas.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/capas/${c.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  {c.capaNumber}
                </Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Complaints */}
      <div id="complaints" className={sectionClass}>
        <div className={sectionHeader}>
          <h2 className={sectionTitle}>
            <MessageSquare size={16} /> Complaints ({complaints.length})
          </h2>
          <Link href="/complaints/new" className={addBtn}>
            <Plus size={12} /> New complaint
          </Link>
        </div>
        {complaints.length === 0 ? (
          <p className="text-sm text-gray-500">No complaints.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {complaints.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/complaints/${c.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  {c.complaintNumber}
                </Link>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
