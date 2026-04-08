import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default async function NotificationSettingsPage() {
  const session = await auth();

  const hasConnection = await prisma.m365Connection.count({
    where: { isActive: true },
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings/m365"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
      </div>

      {!hasConnection && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-600" />
            <p className="text-amber-800 text-sm">
              Email and SMS notifications require an active Microsoft 365 connection.{" "}
              <Link href="/settings/m365" className="underline font-medium">
                Connect your account
              </Link>
              {" "}to enable email/SMS delivery. In-app notifications will still work.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <p className="text-sm text-gray-500 mb-6">
          Choose how you want to receive notifications for work order assignments, status changes, AI suggestions, and maintenance reminders.
        </p>
        <NotificationPreferencesForm />
      </div>
    </div>
  );
}
