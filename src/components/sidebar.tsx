"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Calendar,
  FileText,
  Users,
  Mail,
  LogOut,
  Menu,
  X,
  FolderKanban,
  Bell,
  AlertTriangle,
  Shield,
  MessageSquareWarning,
  User,
  ClipboardCheck,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/schedules", label: "Schedules", icon: Calendar },
  { href: "/checklists", label: "PM Checklists", icon: ClipboardCheck },
  { href: "/maintenance", label: "Maintenance Log", icon: FileText },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/ncrs", label: "NCRs", icon: AlertTriangle },
  { href: "/capas", label: "CAPAs", icon: Shield },
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notifications", label: "Notifications", icon: Bell, showBadge: true },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/settings/m365", label: "My Email Scanner", icon: Mail },
];

const adminNavItems = [
  { href: "/users", label: "Users", icon: Users },
];

export function Sidebar({ userName, userRole, unreadCount = 0 }: { userName: string; userRole: string; unreadCount?: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const nav = (
    <>
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">QMS Tracker</h1>
        <p className="text-xs text-gray-400 mt-0.5">RubberForm Recycled Products</p>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const badge = (item as { showBadge?: boolean }).showBadge && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
              {badge && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}

        {userRole === "admin" && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</p>
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{userName}</p>
            <p className="text-xs text-gray-400 capitalize">{userRole}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
            className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gray-800 text-white rounded-md inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-800 flex flex-col transform transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {nav}
      </aside>
    </>
  );
}
