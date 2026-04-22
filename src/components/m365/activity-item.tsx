"use client";

import { format } from "date-fns";
import Link from "next/link";
import { FolderPlus } from "lucide-react";

interface ActivityMessage {
  id: string;
  sourceType: string;
  subject: string | null;
  senderName: string | null;
  bodyPreview: string;
  receivedAt: Date | string;
  processedAt: Date | string;
  actionTaken: string;
  confidence: number | null;
  suggestions: {
    id: string;
    suggestionType: string;
    status: string;
    createdRecordType?: string | null;
    createdRecordId?: string | null;
    reviewer: { name: string } | null;
  }[];
}

const actionLabels: Record<string, string> = {
  work_order: "Work Order Suggested",
  maintenance_log: "Maintenance Log Suggested",
  status_update: "Status Update Suggested",
  ignored: "Not Relevant",
  pre_filtered: "Filtered",
  promoted_to_project: "Converted to Project",
};

const actionColors: Record<string, string> = {
  work_order: "border-l-blue-500",
  maintenance_log: "border-l-green-500",
  status_update: "border-l-orange-500",
  ignored: "border-l-gray-300",
  pre_filtered: "border-l-gray-300",
  promoted_to_project: "border-l-purple-500",
};

// Any message where no suggestion was ever created is a candidate for manual
// promotion to a project. Already-promoted messages link to the new project.
const PROMOTABLE_ACTIONS = new Set(["ignored", "pre_filtered"]);

export function ActivityItem({ message }: { message: ActivityMessage }) {
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${
        actionColors[message.actionTaken] || "border-l-gray-300"
      } rounded-lg p-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase">
              {message.sourceType}
            </span>
            <span className="text-xs text-gray-300">&middot;</span>
            <span className="text-xs text-gray-500">
              {format(new Date(message.processedAt), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="font-medium text-gray-900 mt-1">
            {message.subject || "(No subject)"}
          </p>
          <p className="text-sm text-gray-500">
            From {message.senderName || "Unknown"}
          </p>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
            {message.bodyPreview}
          </p>
        </div>
        <div className="text-left sm:text-right sm:ml-4 shrink-0">
          <span
            className={`text-xs font-medium ${
              message.actionTaken === "ignored" ? "text-gray-400" : "text-blue-600"
            }`}
          >
            {actionLabels[message.actionTaken] || message.actionTaken}
          </span>
          {message.confidence !== null && (
            <p className="text-xs text-gray-400 mt-0.5">
              {Math.round(message.confidence * 100)}%
            </p>
          )}
        </div>
      </div>

      {/* Show suggestion outcomes */}
      {message.suggestions.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {message.suggestions.map((s) => {
            const pill = (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  s.status === "approved"
                    ? "bg-green-100 text-green-700"
                    : s.status === "rejected"
                    ? "bg-red-100 text-red-700"
                    : s.status === "auto_applied"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {s.status === "auto_applied" ? "Auto-applied" : s.status}
                {s.reviewer && ` by ${s.reviewer.name}`}
              </span>
            );
            if (s.createdRecordType === "Project" && s.createdRecordId) {
              return (
                <Link key={s.id} href={`/projects/${s.createdRecordId}`} className="hover:underline">
                  {pill}
                </Link>
              );
            }
            return <span key={s.id}>{pill}</span>;
          })}
        </div>
      )}

      {/* Offer to promote unused messages into a project */}
      {PROMOTABLE_ACTIONS.has(message.actionTaken) && message.suggestions.length === 0 && (
        <div className="mt-3">
          <Link
            href={`/projects/new?fromMessageId=${message.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
          >
            <FolderPlus size={12} />
            Create Project from This Email
          </Link>
        </div>
      )}
    </div>
  );
}
