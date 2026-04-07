"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface ScanConfig {
  scanAllMailboxes: boolean;
  excludedMailboxes: string;
  scanSharePoint: boolean;
  lastUserSyncAt: string | null;
}

interface Stats {
  activeMailboxes: number;
  totalMailboxes: number;
  sharePointSites: number;
}

export function OrgScanConfig() {
  const [config, setConfig] = useState<ScanConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/m365/scan-config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggleScanMailboxes() {
    if (!config) return;
    setSaving(true);
    const newVal = !config.scanAllMailboxes;
    await fetch("/api/m365/scan-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanAllMailboxes: newVal }),
    });
    setConfig({ ...config, scanAllMailboxes: newVal });
    setSaving(false);
  }

  async function toggleSharePoint() {
    if (!config) return;
    setSaving(true);
    const newVal = !config.scanSharePoint;
    await fetch("/api/m365/scan-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanSharePoint: newVal }),
    });
    setConfig({ ...config, scanSharePoint: newVal });
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scanning Configuration</h2>

      {/* Email scanning */}
      <div className="flex items-center justify-between py-3 border-b border-gray-100">
        <div>
          <p className="font-medium text-gray-900">Scan All Organization Emails</p>
          <p className="text-sm text-gray-500">
            Auto-discover and scan all @rubberform.com mailboxes
          </p>
          {stats && (
            <p className="text-xs text-gray-400 mt-1">
              {stats.activeMailboxes} of {stats.totalMailboxes} mailboxes active
              {config?.lastUserSyncAt && (
                <> &middot; Last synced {format(new Date(config.lastUserSyncAt), "MMM d, h:mm a")}</>
              )}
            </p>
          )}
        </div>
        <button
          onClick={toggleScanMailboxes}
          disabled={saving}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            config?.scanAllMailboxes ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
              config?.scanAllMailboxes ? "translate-x-6" : ""
            }`}
          />
        </button>
      </div>

      {/* SharePoint scanning */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="font-medium text-gray-900">Scan SharePoint Sites</p>
          <p className="text-sm text-gray-500">
            Index QMS documents from SharePoint document libraries
          </p>
          {stats && (
            <p className="text-xs text-gray-400 mt-1">
              {stats.sharePointSites} site(s) discovered
            </p>
          )}
        </div>
        <button
          onClick={toggleSharePoint}
          disabled={saving}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            config?.scanSharePoint ? "bg-blue-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
              config?.scanSharePoint ? "translate-x-6" : ""
            }`}
          />
        </button>
      </div>

      {/* Azure AD info */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>Requires Application Permissions:</strong> Your Azure AD admin must grant
          application-level permissions (Mail.Read, User.Read.All, Sites.Read.All, Files.Read.All)
          and click &ldquo;Grant admin consent&rdquo; in the Azure Portal for org-wide scanning to work.
        </p>
      </div>
    </div>
  );
}
