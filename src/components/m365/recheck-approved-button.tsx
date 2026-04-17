"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RecheckApprovedButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  async function handleClick() {
    if (!confirm(
      "This will check every approved suggestion and move any whose record no longer exists back to 'Pending Review'. Continue?"
    )) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/suggestions/recheck-approved", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setResult(
        data.requeued === 0
          ? `Checked ${data.checked} — all approved records still exist.`
          : `Moved ${data.requeued} of ${data.checked} back to pending.`
      );
      router.refresh();
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md disabled:opacity-50"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Checking..." : "Re-check approved items"}
      </button>
      {result && (
        <p className="text-xs text-gray-600 mt-2">{result}</p>
      )}
    </div>
  );
}
