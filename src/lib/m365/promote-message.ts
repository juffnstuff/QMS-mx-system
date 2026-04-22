import { prisma } from "@/lib/prisma";

// Record types a ProcessedMessage can be promoted to. Values match the
// schema's ProcessedMessage.actionTaken + AISuggestion.kind conventions.
export type PromotedRecordKind =
  | "project"
  | "work_order"
  | "equipment"
  | "maintenance_log"
  | "ncr"
  | "capa"
  | "complaint";

const ACTION_BY_KIND: Record<PromotedRecordKind, string> = {
  project: "promoted_to_project",
  work_order: "promoted_to_work_order",
  equipment: "promoted_to_equipment",
  maintenance_log: "promoted_to_maintenance_log",
  ncr: "promoted_to_ncr",
  capa: "promoted_to_capa",
  complaint: "promoted_to_complaint",
};

const SUGGESTION_TYPE_BY_KIND: Record<PromotedRecordKind, string> = {
  project: "create_project",
  work_order: "create_work_order",
  equipment: "create_equipment",
  maintenance_log: "create_maintenance_log",
  ncr: "create_ncr",
  capa: "create_capa",
  complaint: "create_complaint",
};

// Prisma AISuggestion.createdRecordType values used when linking back to the
// record. Kept in one place so the activity UI can match.
const RECORD_TYPE_NAME_BY_KIND: Record<PromotedRecordKind, string> = {
  project: "Project",
  work_order: "WorkOrder",
  equipment: "Equipment",
  maintenance_log: "MaintenanceLog",
  ncr: "NonConformance",
  capa: "CAPA",
  complaint: "CustomerComplaint",
};

export interface PromoteInput {
  fromMessageId: string | null | undefined;
  kind: PromotedRecordKind;
  createdRecordId: string;
  reviewerId: string;
  // Fields worth echoing back into the suggestion payload (for auditability).
  // Free-form; only the most useful fields, not the whole record.
  payloadSummary?: Record<string, string | null | undefined>;
}

// Mark a ProcessedMessage as promoted and log the promotion as an
// "auto-approved" AISuggestion linked to the created record. Swallows errors
// — the calling endpoint has already created the record, so promotion-log
// failures should not block the response.
export async function markMessagePromoted(input: PromoteInput): Promise<void> {
  const { fromMessageId, kind, createdRecordId, reviewerId, payloadSummary } = input;
  if (!fromMessageId || typeof fromMessageId !== "string") return;

  try {
    await prisma.processedMessage.updateMany({
      where: { id: fromMessageId },
      data: { actionTaken: ACTION_BY_KIND[kind] },
    });
  } catch (err) {
    console.error(`[promote-message] Failed to mark ${kind} source:`, err);
  }

  try {
    await prisma.aISuggestion.create({
      data: {
        processedMessageId: fromMessageId,
        suggestionType: SUGGESTION_TYPE_BY_KIND[kind],
        kind,
        status: "approved",
        payload: JSON.stringify({
          ...(payloadSummary ?? {}),
          source: "email_promotion",
        }),
        createdRecordType: RECORD_TYPE_NAME_BY_KIND[kind],
        createdRecordId,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: "Promoted from email by operator",
      },
    });
  } catch (err) {
    console.error(`[promote-message] Failed to log ${kind} promotion suggestion:`, err);
  }
}

// Fetch a ProcessedMessage for prefilling a "create from email" form.
// Returns null if the id isn't real — callers should treat it as "no prefill".
export async function fetchMessageForPrefill(id: string | null | undefined) {
  if (!id || typeof id !== "string") return null;
  return prisma.processedMessage.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      senderName: true,
      senderEmail: true,
      bodyPreview: true,
      bodyContent: true,
      receivedAt: true,
    },
  });
}

// Build a title from the message subject, stripping common Re:/Fwd: prefixes.
export function titleFromMessage(
  msg: { subject: string | null } | null,
): string {
  if (!msg?.subject) return "";
  return msg.subject.replace(/^(re|fwd?):\s*/i, "").trim() || "";
}

// Convert HTML to readable plain text. Handles the common Outlook email
// shape: strips script/style, replaces line-breaking tags with \n, drops
// remaining tags, decodes the core entities, collapses whitespace.
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "• ");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Cap to a reasonable size so we don't dump a 50KB newsletter into a form.
const MAX_PREFILL_BODY = 5000;

// Prefer the full body when available, falling back to the preview. Trim to
// a cap to keep forms sane even for long email chains.
function bestBodyText(
  msg: { bodyContent?: string | null; bodyPreview: string },
): string {
  const raw = msg.bodyContent ?? msg.bodyPreview;
  const cleaned = /[<>]/.test(raw) ? htmlToPlainText(raw) : raw;
  if (cleaned.length <= MAX_PREFILL_BODY) return cleaned;
  return cleaned.slice(0, MAX_PREFILL_BODY) + "\n\n… (truncated — see the source email for the full content)";
}

// Build a description snippet referencing the source email. Uses the full
// body when stored, otherwise falls back to the 500-char preview.
export function descriptionFromMessage(
  msg: {
    senderName: string | null;
    senderEmail: string | null;
    receivedAt: Date | string;
    bodyPreview: string;
    bodyContent?: string | null;
  } | null,
): string {
  if (!msg) return "";
  const date = new Date(msg.receivedAt).toLocaleDateString();
  const sender =
    (msg.senderName ? ` from ${msg.senderName}` : "") +
    (msg.senderEmail ? ` <${msg.senderEmail}>` : "");
  return `Created from email received ${date}${sender}.\n\n${bestBodyText(msg)}`;
}
