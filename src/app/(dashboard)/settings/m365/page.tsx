import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConnectionCard } from "@/components/m365/connection-card";
import { MonitorList } from "@/components/m365/monitor-list";

export default async function M365SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;

  const connection = await prisma.m365Connection.findFirst({
    where: { isActive: true },
    include: { connectedByUser: { select: { name: true } } },
  }).catch(() => null);

  const monitors = await prisma.m365MonitorConfig.findMany({
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  const pendingSuggestions = await prisma.aISuggestion.count({
    where: { status: "pending" },
  }).catch(() => 0);

  const messagesLast24h = await prisma.processedMessage.count({
    where: { processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MS365 Connector</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered email and Teams monitoring for automatic maintenance tracking
          </p>
        </div>
      </div>

      {params.success === "connected" && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Microsoft 365 connected successfully! Now add mailboxes or Teams channels to monitor.
        </div>
      )}

      {params.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {params.error === "oauth_denied"
            ? "Microsoft 365 authorization was denied."
            : params.error === "token_exchange"
            ? "Failed to complete Microsoft 365 connection. Please try again."
            : `Error: ${decodeURIComponent(params.error)}`}
        </div>
      )}

      {/* Connection Status */}
      <ConnectionCard
        connected={!!connection}
        connectedBy={connection?.connectedByUser.name}
        connectedAt={connection?.createdAt}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Link
          href="/settings/m365/suggestions"
          className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <p className="text-sm text-gray-500">Pending Suggestions</p>
          <p className="text-2xl font-bold text-gray-900">{pendingSuggestions}</p>
          <p className="text-xs text-blue-600 mt-1">Review &rarr;</p>
        </Link>
        <Link
          href="/settings/m365/activity"
          className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <p className="text-sm text-gray-500">Messages (24h)</p>
          <p className="text-2xl font-bold text-gray-900">{messagesLast24h}</p>
          <p className="text-xs text-blue-600 mt-1">View activity &rarr;</p>
        </Link>
      </div>

      {/* Monitored Sources */}
      {connection && (
        <div className="mt-6">
          <MonitorList monitors={monitors} />
        </div>
      )}
    </div>
  );
}
