import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  UserPlus,
  Shield,
  Wrench,
  ClipboardList,
  AlertOctagon,
  FileWarning,
  FolderKanban,
  Mail,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import { AddUserForm } from "@/components/add-user-form";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { UserRoleToggle } from "@/components/user-role-toggle";
import { DeleteUserButton } from "@/components/delete-user-button";
import Link from "next/link";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/");
  const isSuperAdmin = session.user.isSuperAdmin;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      phone: true,
      notifyEmail: true,
      notifySMS: true,
      createdAt: true,
      _count: {
        select: {
          maintenanceLogs: true,
          assignedOrders: true,
          assignedEquipment: true,
          assignedSchedules: true,
          submittedNCRs: true,
          investigatedNCRs: true,
          originatedCAPAs: true,
          assignedCAPAs: true,
          submittedComplaints: true,
          assignedComplaints: true,
          createdProjects: true,
          ledProjects: true,
        },
      },
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
        </div>
      </div>

      {/* Add User Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={18} className="text-gray-600" />
          <h2 className="font-semibold text-gray-900">Add New User</h2>
        </div>
        <AddUserForm />
      </div>

      {/* Users Grid */}
      <div className="space-y-4">
        {users.map((user) => {
          const totalAssignments =
            user._count.assignedOrders +
            user._count.assignedEquipment +
            user._count.assignedSchedules +
            user._count.investigatedNCRs +
            user._count.assignedCAPAs +
            user._count.assignedComplaints +
            user._count.ledProjects;

          return (
            <div
              key={user.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role badge */}
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
                    {user.isSuperAdmin
                      ? "Super Admin"
                      : user.role === "admin"
                        ? "Admin"
                        : "Operator"}
                  </span>

                  {/* Notification indicators */}
                  {user.notifyEmail && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-50 text-green-700" title="Email notifications enabled">
                      <Mail size={12} />
                      Email
                    </span>
                  )}
                  {user.notifySMS && user.phone && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-50 text-green-700" title="SMS notifications enabled">
                      <Smartphone size={12} />
                      SMS
                    </span>
                  )}
                  {!user.notifyEmail && !user.notifySMS && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-50 text-yellow-700" title="No notifications enabled">
                      No alerts
                    </span>
                  )}

                  <span className="text-xs text-gray-400">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Assignment stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                <Link
                  href={`/equipment?assignee=${user.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors"
                >
                  <Wrench size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.assignedEquipment}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Equipment</p>
                  </div>
                </Link>
                <Link
                  href={`/work-orders?assignee=${user.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors"
                >
                  <ClipboardList size={14} className="text-purple-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.assignedOrders}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Work Orders</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <Wrench size={14} className="text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.assignedSchedules}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Schedules</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <AlertOctagon size={14} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.investigatedNCRs}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">NCRs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <FileWarning size={14} className="text-orange-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.assignedCAPAs}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">CAPAs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <MessageSquare size={14} className="text-teal-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.assignedComplaints}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Complaints</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <FolderKanban size={14} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user._count.ledProjects}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Projects</p>
                  </div>
                </div>
              </div>

              {/* Footer: actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {totalAssignments} total assignment{totalAssignments !== 1 ? "s" : ""} · {user._count.maintenanceLogs} maintenance log{user._count.maintenanceLogs !== 1 ? "s" : ""}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <UserRoleToggle userId={user.id} userName={user.name} currentRole={user.role} />
                  <ResetPasswordButton userId={user.id} userName={user.name} />
                  {isSuperAdmin && !user.isSuperAdmin && user.id !== session.user.id && (
                    <DeleteUserButton userId={user.id} userName={user.name} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
