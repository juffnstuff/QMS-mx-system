"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  FolderPlus,
  ChevronDown,
  FolderKanban,
  ClipboardList,
  Wrench,
  FileText,
  AlertTriangle,
  Shield,
  MessageSquareWarning,
} from "lucide-react";

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
// promotion to one of these record types. Already-promoted messages show the
// outcome as a suggestion pill below.
const PROMOTABLE_ACTIONS = new Set(["ignored", "pre_filtered"]);

type PromotionOption = {
  label: string;
  href: (messageId: string) => string;
  icon: React.ComponentType<{ size?: number }>;
  note?: string;
};

// Project is first because it has real prefill support. Other types open a
// blank form today; full prefill + promotion tracking can be added per type.
const PROMOTION_OPTIONS: PromotionOption[] = [
  {
    label: "Project",
    href: (id) => `/projects/new?fromMessageId=${id}`,
    icon: FolderKanban,
  },
  {
    label: "Work Order",
    href: (id) => `/work-orders/new?fromMessageId=${id}`,
    icon: ClipboardList,
  },
  {
    label: "Equipment",
    href: (id) => `/equipment/new?fromMessageId=${id}`,
    icon: Wrench,
  },
  {
    label: "Maintenance Log",
    href: (id) => `/maintenance/new?fromMessageId=${id}`,
    icon: FileText,
  },
  {
    label: "NCR",
    href: (id) => `/ncrs/new?fromMessageId=${id}`,
    icon: AlertTriangle,
  },
  {
    label: "CAPA",
    href: (id) => `/capas/new?fromMessageId=${id}`,
    icon: Shield,
  },
  {
    label: "Complaint",
    href: (id) => `/complaints/new?fromMessageId=${id}`,
    icon: MessageSquareWarning,
  },
];

function PromoteMenu({ messageId }: { messageId: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors"
      >
        <FolderPlus size={12} />
        Create from this email
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 w-56 bg-white border border-gray-200 rounded-md shadow-lg py-1">
          {PROMOTION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <Link
                key={opt.label}
                href={opt.href(messageId)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
              >
                <Icon size={14} />
                {opt.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

      {/* Offer to promote unused messages into any record type */}
      {PROMOTABLE_ACTIONS.has(message.actionTaken) && message.suggestions.length === 0 && (
        <div className="mt-3">
          <PromoteMenu messageId={message.id} />
        </div>
      )}
    </div>
  );
}
