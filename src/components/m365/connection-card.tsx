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
              {connected ? "MS365 Connected" : "Connect Your MS365 Account"}
            </h2>
            {connected && connectedBy && connectedAt && (
              <p className="text-sm text-gray-500">
                Connected as {connectedBy} on{" "}
                {format(new Date(connectedAt), "MMM d, yyyy")}
              </p>
            )}
            {!connected && (
              <p className="text-sm text-gray-500">
                Connect your @rubberform.com email to start scanning
              </p>
            )}
          </div>
        </div>

        <a
          href="/api/m365/auth"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            connected
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {connected ? "Reconnect" : "Connect MS365"}
        </a>
      </div>
    </div>
  );
}
