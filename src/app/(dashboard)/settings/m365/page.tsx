import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConnectionCard } from "@/components/m365/connection-card";
import { ScanButton } from "@/components/m365/scan-button";

export default async function M365SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;

  // Get THIS user's connection
  const connection = await prisma.m365Connection
    .findFirst({
      where: { connectedBy: session.user.id!, isActive: true },
      include: { connectedByUser: { select: { name: true } } },
    })
    .catch(() => null);

  // Stats scoped to this user's scans
  const pendingSuggestions = await prisma.aISuggestion
    .count({
      where: {
        status: "pending",
        processedMessage: { scannedByUserId: session.user.id },
      },
    })
    .catch(() => 0);

  const messagesLast24h = await prisma.processedMessage
    .count({
      where: {
        scannedByUserId: session.user.id,
        processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    .catch(() => 0);

  const approvedTotal = await prisma.aISuggestion
    .count({
      where: {
        status: "approved",
        processedMessage: { scannedByUserId: session.user.id },
      },
    })
    .catch(() => 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Email Scanner</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your MS365 account and AI will scan your emails and Teams
          channels for maintenance items, equipment, and projects
        </p>
      </div>

      {params.success === "connected" && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          Your Microsoft 365 account is connected! Click &ldquo;Scan My
          Email&rdquo; to start finding maintenance items.
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

      {/* How it works */}
      {!connection && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>
              Connect your @rubberform.com email using the button above
            </li>
            <li>
              Click &ldquo;Scan New&rdquo; to scan your inbox and Teams
              channels
            </li>
            <li>
              AI analyzes emails from shop@, Joe, Anthony, Jesse, Bill, Aaron
              and others for equipment, vehicles, pumps, parts, and maintenance
              items
            </li>
            <li>
              It also scans Teams conversations for the same signals
            </li>
            <li>
              Review AI suggestions and approve to create work orders,
              maintenance logs, or update equipment status
            </li>
            <li>
              Approved items become visible to the whole team
            </li>
          </ol>
        </div>
      )}

      {/* Scan Button — the main action */}
      {connection && (
        <div className="mt-6">
          <ScanButton />
        </div>
      )}

      {/* Quick Stats */}
      {connection && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Link
            href="/settings/m365/suggestions"
            className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <p className="text-sm text-gray-500">Pending Review</p>
            <p className="text-2xl font-bold text-gray-900">
              {pendingSuggestions}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Review &amp; approve &rarr;
            </p>
          </Link>
          <Link
            href="/settings/m365/activity"
            className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <p className="text-sm text-gray-500">Scanned (24h)</p>
            <p className="text-2xl font-bold text-gray-900">
              {messagesLast24h}
            </p>
            <p className="text-xs text-blue-600 mt-1">View activity &rarr;</p>
          </Link>
          <Link
            href="/settings/m365/suggestions?status=approved"
            className="bg-white p-4 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
          >
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-bold text-gray-900">{approvedTotal}</p>
            <p className="text-xs text-green-600 mt-1">
              Items pushed to team &rarr;
            </p>
          </Link>
        </div>
      )}

      {/* Last polled info */}
      {connection?.lastPolledAt && (
        <div className="mt-4 text-xs text-gray-400 text-center">
          Last scanned:{" "}
          {new Date(connection.lastPolledAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
