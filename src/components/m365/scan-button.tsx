"use client";

import { useState } from "react";

interface ScanResult {
  mailboxesSynced: number;
  messagesPolled: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  autoApplied: number;
  teamsMessages: number;
  sharePointDocs: number;
  preFiltered: number;
  errors: string[];
}

export function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan() {
    setScanning(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/m365/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scan All</h2>
          <p className="text-sm text-gray-500">
            Scan all org emails, Teams channels, and SharePoint for maintenance items
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {scanning ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan All Now
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-2">Scan Complete</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-green-600">Mailboxes Synced</p>
              <p className="text-lg font-bold text-green-900">{result.mailboxesSynced}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Messages Found</p>
              <p className="text-lg font-bold text-green-900">{result.messagesPolled}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">AI Analyzed</p>
              <p className="text-lg font-bold text-green-900">{result.messagesAnalyzed}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Suggestions Created</p>
              <p className="text-lg font-bold text-green-900">{result.suggestionsCreated}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Auto-Applied</p>
              <p className="text-lg font-bold text-green-900">{result.autoApplied}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Teams Messages</p>
              <p className="text-lg font-bold text-green-900">{result.teamsMessages}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">SharePoint Docs</p>
              <p className="text-lg font-bold text-green-900">{result.sharePointDocs}</p>
            </div>
            <div>
              <p className="text-xs text-green-600">Pre-Filtered</p>
              <p className="text-lg font-bold text-green-900">{result.preFiltered}</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs text-yellow-700">
              {result.errors.length} warning(s): {result.errors.join("; ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
