"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";

interface MigrateResult {
  success: boolean;
  updated: number;
  skipped: number;
  details: { id: string; name: string; from: string; to: string; match: string }[];
}

export function CriticalityMigrateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrateResult | null>(null);

  const handleMigrate = async () => {
    const confirmed = window.confirm(
      "This will scan all equipment notes for criticality annotations (e.g. \"Criticality A\", \"Class B\") and update the criticality field where it differs.\n\nContinue?"
    );
    if (!confirmed) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/equipment/migrate-criticality", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Migration failed");
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      alert("Migration request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleMigrate}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
      >
        <Wand2 size={16} />
        {loading ? "Scanning notes..." : "Auto-Populate Criticality from Notes"}
      </button>

      {result && (
        <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg text-sm">
          <p className="font-medium text-gray-900 mb-2">
            Migration complete: {result.updated} updated, {result.skipped} already correct
          </p>
          {result.details.length > 0 && (
            <div className="space-y-1">
              {result.details.map((d) => (
                <p key={d.id} className="text-gray-600">
                  <span className="font-medium">{d.name}</span>
                  {" — "}
                  <span className="text-red-500">Class {d.from}</span>
                  {" → "}
                  <span className="text-green-600">Class {d.to}</span>
                  <span className="text-gray-400 ml-1">(matched: &quot;{d.match}&quot;)</span>
                </p>
              ))}
            </div>
          )}
          {result.updated === 0 && (
            <p className="text-gray-500">All equipment criticality is already up to date.</p>
          )}
        </div>
      )}
    </div>
  );
}
