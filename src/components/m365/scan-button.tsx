"use client";

import { useState } from "react";

interface ScanResult {
  messagesFound: number;
  messagesAnalyzed: number;
  suggestionsCreated: number;
  preFiltered: number;
  teamsMessages: number;
  errors: string[];
}

export function ScanButton() {
  const [scanning, setScanning] = useState(false);
  const [scanType, setScanType] = useState<"normal" | "deep" | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan(deep: boolean) {
    setScanning(true);
    setScanType(deep ? "deep" : "normal");
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/m365/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Scan failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      setScanType(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Scan Email &amp; Teams
          </h2>
          <p className="text-sm text-gray-500">
            AI scans your inbox and Teams channels for service, maintenance, and
            equipment needs
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleScan(false)}
          disabled={scanning}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {scanning && scanType === "normal" ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan New
            </>
          )}
        </button>

        <button
          onClick={() => handleScan(true)}
          disabled={scanning}
          className="px-5 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {scanning && scanType === "deep" ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Deep Scanning...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Deep Scan (30 days)
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        <strong>Scan New:</strong> fetches only new messages since last scan.{" "}
        <strong>Deep Scan:</strong> re-scans the last 30 days of email (catches
        anything missed).
      </p>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800 mb-3">
            Scan Complete
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-green-600">Emails</p>
              <p className="text-lg font-bold text-green-900">
                {result.messagesFound - result.teamsMessages}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600">Teams</p>
              <p className="text-lg font-bold text-green-900">
                {result.teamsMessages}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600">AI Analyzed</p>
              <p className="text-lg font-bold text-green-900">
                {result.messagesAnalyzed}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600">Suggestions</p>
              <p className="text-lg font-bold text-green-900">
                {result.suggestionsCreated}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600">Skipped</p>
              <p className="text-lg font-bold text-green-900">
                {result.preFiltered}
              </p>
            </div>
          </div>
          {result.suggestionsCreated > 0 && (
            <p className="mt-3 text-sm text-green-700">
              <a
                href="/settings/m365/suggestions"
                className="underline font-medium"
              >
                Review {result.suggestionsCreated} suggestion(s)
              </a>{" "}
              to approve and push to the team.
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <p className="font-medium mb-1">Warnings:</p>
              {result.errors.map((e, i) => (
                <p key={i}>- {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
