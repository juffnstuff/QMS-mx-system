"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, RotateCw } from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionError: string | null;
  excluded: boolean;
  userEditedText: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsSection({
  processedMessageId,
  suggestionId,
  attachments,
  editable,
}: {
  processedMessageId: string;
  suggestionId: string;
  attachments: Attachment[];
  editable: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [message, setMessage] = useState("");

  // Local edit state — keyed by attachment id. Falls back to extractedText so
  // the textarea is always controlled.
  const [edits, setEdits] = useState<Record<string, { excluded: boolean; text: string }>>(() =>
    Object.fromEntries(
      attachments.map((a) => [
        a.id,
        {
          excluded: a.excluded,
          text: a.userEditedText ?? a.extractedText ?? "",
        },
      ]),
    ),
  );

  function setExcluded(id: string, excluded: boolean) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], excluded } }));
  }
  function setText(id: string, text: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], text } }));
  }

  async function saveAttachment(id: string) {
    setWorking(true);
    setMessage("");
    try {
      const att = attachments.find((a) => a.id === id);
      const baseText = att?.extractedText ?? "";
      const body: Record<string, unknown> = { excluded: edits[id].excluded };
      // Only send userEditedText if it actually differs from the original.
      if (edits[id].text !== baseText) {
        body.userEditedText = edits[id].text;
      }
      const res = await fetch(`/api/m365/attachments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setMessage("Saved.");
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setWorking(false);
    }
  }

  async function reanalyze() {
    if (!confirm(
      "Re-run the AI on this message using the email body plus the attachments you haven't excluded (and any edits you've made). The proposed fields below will be overwritten.",
    )) return;
    setReanalyzing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/reanalyze`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Re-analyze failed");
      setMessage("Re-analyzed — proposed fields updated.");
      router.refresh();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-medium text-gray-700 inline-flex items-center gap-1.5">
          <Paperclip size={14} />
          Attachments ({attachments.length})
        </h4>
        {editable && (
          <button
            onClick={reanalyze}
            disabled={reanalyzing || working}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            title="Re-run the AI with your attachment edits/exclusions"
          >
            <RotateCw size={12} className={reanalyzing ? "animate-spin" : ""} />
            {reanalyzing ? "Re-analyzing..." : "Re-analyze with edits"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {attachments.map((a) => {
          const edit = edits[a.id];
          const wasEdited = a.userEditedText !== null && a.userEditedText !== a.extractedText;
          return (
            <details
              key={a.id}
              className={`bg-white rounded border ${
                edit.excluded ? "border-red-200 opacity-70" : "border-gray-200"
              }`}
            >
              <summary className="px-3 py-2 cursor-pointer flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.contentType} · {formatBytes(a.sizeBytes)}
                    {a.extractionError ? (
                      <span className="text-red-600"> · {a.extractionError}</span>
                    ) : a.extractedText ? (
                      <span className="text-green-700"> · {a.extractedText.length.toLocaleString()} chars extracted</span>
                    ) : (
                      <span className="text-gray-400"> · no text</span>
                    )}
                    {wasEdited && (
                      <span className="text-amber-700"> · edited</span>
                    )}
                    {edit.excluded && (
                      <span className="text-red-600"> · excluded</span>
                    )}
                  </p>
                </div>
              </summary>
              <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
                {editable ? (
                  <>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700 mt-2">
                      <input
                        type="checkbox"
                        checked={edit.excluded}
                        onChange={(e) => setExcluded(a.id, e.target.checked)}
                      />
                      Exclude this attachment from re-analysis
                    </label>
                    {a.extractedText !== null ? (
                      <>
                        <textarea
                          rows={8}
                          value={edit.text}
                          onChange={(e) => setText(a.id, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Extracted attachment text — edit before re-analyzing if needed"
                        />
                        <button
                          onClick={() => saveAttachment(a.id)}
                          disabled={working}
                          className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                        >
                          Save attachment changes
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 italic mt-2">
                        No text was extracted from this attachment.
                      </p>
                    )}
                  </>
                ) : (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono mt-2 max-h-72 overflow-y-auto">
                    {a.userEditedText ?? a.extractedText ?? "(no text extracted)"}
                  </pre>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {message && (
        <p className="text-xs text-gray-600 mt-2">{message}</p>
      )}
      {/* Pin processedMessageId in DOM for debug; harmless */}
      <input type="hidden" value={processedMessageId} readOnly />
    </div>
  );
}
