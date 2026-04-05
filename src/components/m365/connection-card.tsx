"use client";

import { format } from "date-fns";

export function ConnectionCard({
  connected,
  connectedBy,
  connectedAt,
}: {
  connected: boolean;
  connectedBy?: string;
  connectedAt?: Date;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              connected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <div>
            <h2 className="font-semibold text-gray-900">
              Microsoft 365 {connected ? "Connected" : "Not Connected"}
            </h2>
            {connected && connectedBy && connectedAt && (
              <p className="text-sm text-gray-500">
                Connected by {connectedBy} on{" "}
                {format(new Date(connectedAt), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>

        {!connected ? (
          <a
            href="/api/m365/auth"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect MS365
          </a>
        ) : (
          <a
            href="/api/m365/auth"
            className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reconnect
          </a>
        )}
      </div>

      {!connected && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Setup required:</strong> You need to register an Azure AD app first.
            Add these environment variables to Railway:
          </p>
          <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li>AZURE_AD_CLIENT_ID</li>
            <li>AZURE_AD_CLIENT_SECRET</li>
            <li>AZURE_AD_TENANT_ID</li>
            <li>M365_ENCRYPTION_KEY</li>
            <li>ANTHROPIC_API_KEY</li>
            <li>CRON_SECRET</li>
          </ul>
        </div>
      )}
    </div>
  );
}
