import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { MarkAllReadButton } from "@/components/mark-all-read-button";

const relatedLinks: Record<string, (id: string) => string> = {
  WorkOrder: (id) => `/work-orders/${id}`,
  Equipment: (id) => `/equipment/${id}`,
  AISuggestion: (id) => `/settings/m365/suggestions`,
  MaintenanceSchedule: (id) => `/schedules`,
  Project: (id) => `/projects/${id}`,
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && <MarkAllReadButton />}
          <Link
            href="/settings/notifications"
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <Settings size={16} />
            Preferences
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => {
              const link = n.relatedType && n.relatedId
                ? relatedLinks[n.relatedType]?.(n.relatedId)
                : undefined;
              return (
                <div
                  key={n.id}
                  className={`p-4 ${!n.read ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                        <p className={`text-sm font-medium ${!n.read ? "text-gray-900" : "text-gray-700"}`}>
                          {n.title}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          {new Date(n.createdAt).toLocaleDateString()}{" "}
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {link && (
                          <Link href={link} className="text-xs text-blue-600 hover:underline">
                            View &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
