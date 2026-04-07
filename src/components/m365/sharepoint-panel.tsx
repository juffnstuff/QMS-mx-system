"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface SharePointSite {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  isActive: boolean;
  lastScannedAt: string | null;
}

interface SharePointDoc {
  id: string;
  name: string;
  webUrl: string;
  contentType: string | null;
  lastModified: string;
  actionTaken: string;
}

export function SharePointPanel() {
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [recentDocs, setRecentDocs] = useState<SharePointDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch("/api/m365/sharepoint")
      .then((r) => r.json())
      .then((data) => {
        setSites(data.sites || []);
        setRecentDocs(data.recentDocs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleScanSharePoint() {
    setScanning(true);
    try {
      const res = await fetch("/api/m365/sharepoint", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Refresh data
        const refresh = await fetch("/api/m365/sharepoint");
        const refreshData = await refresh.json();
        setSites(refreshData.sites || []);
        setRecentDocs(refreshData.recentDocs || []);
      } else {
        console.error("SharePoint scan failed:", data);
      }
    } catch (err) {
      console.error("SharePoint scan error:", err);
    } finally {
      setScanning(false);
    }
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">SharePoint Sites</h2>
          <p className="text-sm text-gray-500">
            QMS documents indexed from SharePoint
          </p>
        </div>
        <button
          onClick={handleScanSharePoint}
          disabled={scanning}
          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Scan SharePoint"}
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          No SharePoint sites discovered yet. Enable SharePoint scanning and run a scan.
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{site.siteName}</p>
                  <p className="text-xs text-gray-500">
                    {site.siteUrl}
                    {site.lastScannedAt && (
                      <> &middot; Scanned {format(new Date(site.lastScannedAt), "MMM d, h:mm a")}</>
                    )}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    site.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {site.isActive ? "Active" : "Paused"}
                </span>
              </div>
            ))}
          </div>

          {recentDocs.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Recent Documents</p>
              <div className="space-y-1">
                {recentDocs.slice(0, 10).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between py-2 px-3 text-sm hover:bg-gray-50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block"
                      >
                        {doc.name}
                      </a>
                      <p className="text-xs text-gray-400">
                        {doc.contentType || "Unknown type"} &middot;{" "}
                        Modified {format(new Date(doc.lastModified), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
