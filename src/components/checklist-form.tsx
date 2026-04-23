"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export interface ChecklistFormItem {
  id: string;
  sortOrder: number;
  section: string | null;
  label: string;
  details: string | null;
  inputType: string;
  isCritical: boolean;
  escalationNote: string | null;
  resultId: string | null;
  result: string; // "pending" | "pass" | "fail" | "na"
  value: string;
  notes: string;
}

export interface ChecklistFormUser {
  id: string;
  name: string;
  role: string;
}

export function ChecklistForm({
  completionId,
  status,
  readOnly,
  initialItems,
  initialNotes,
  initialSupervisorId,
  initialTechnicianId,
  users,
  currentUserId,
}: {
  completionId: string;
  status: string;
  readOnly: boolean;
  initialItems: ChecklistFormItem[];
  initialNotes: string;
  initialSupervisorId: string;
  initialTechnicianId: string;
  users: ChecklistFormUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [notes, setNotes] = useState(initialNotes);
  const [supervisorId, setSupervisorId] = useState(initialSupervisorId);
  const [technicianId, setTechnicianId] = useState(initialTechnicianId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => groupBySection(items), [items]);

  const updateItem = (id: string, patch: Partial<ChecklistFormItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const unanswered = items.filter((i) => i.result === "pending").length;
  const failures = items.filter((i) => i.result === "fail");
  const criticalFailures = failures.filter((i) => i.isCritical);

  async function handleStart() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checklists/${completionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", technicianId: technicianId || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to start");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnstart() {
    if (!confirm("Reset this checklist back to 'pending'? Any answers you've given will stay saved but the checklist will become read-only again until you re-start.")) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/checklists/${completionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unstart" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to reset");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (unanswered > 0) {
        const ok = confirm(
          `${unanswered} item${unanswered === 1 ? "" : "s"} still unanswered. Submit anyway?`,
        );
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }
      const res = await fetch(`/api/checklists/${completionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          results: items.map((i) => ({
            itemId: i.id,
            result: i.result === "pending" ? "na" : i.result,
            value: i.value || null,
            notes: i.notes || null,
          })),
          technicianId: technicianId || null,
          supervisorId: supervisorId || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to submit");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {status === "pending" && !readOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm text-blue-900">
            Ready to start? Tap below to claim this checklist and begin logging.
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-3 min-h-[48px] rounded-md text-base font-semibold hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
          >
            Start checklist
          </button>
        </div>
      )}

      {sections.map((sec) => {
        const total = sec.items.length;
        const answered = sec.items.filter((i) => i.result !== "pending").length;
        return (
        <div key={sec.title} className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="sticky top-0 z-10 px-4 py-3 bg-gray-100/95 backdrop-blur border-b border-gray-200 text-base font-semibold text-gray-800 rounded-t-lg flex items-center justify-between gap-3">
            <span className="truncate">{sec.title}</span>
            <span
              className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${
                answered === total
                  ? "bg-green-100 text-green-700"
                  : answered === 0
                  ? "bg-gray-200 text-gray-600"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {answered}/{total}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {sec.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                readOnly={readOnly || status === "pending"}
                onChange={(patch) => updateItem(item.id, patch)}
              />
            ))}
          </div>
        </div>
        );
      })}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes / Issues Found
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={readOnly || status === "pending"}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm disabled:bg-gray-50"
            placeholder="Overall notes for this PM…"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Technician
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm disabled:bg-gray-50"
            >
              <option value="">— Select —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === currentUserId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supervisor (optional)
            </label>
            <select
              value={supervisorId}
              onChange={(e) => setSupervisorId(e.target.value)}
              disabled={readOnly || status === "pending"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm disabled:bg-gray-50"
            >
              <option value="">— Select —</option>
              {users
                .filter((u) => u.role === "admin")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {!readOnly && status === "in_progress" && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 lg:-mx-8 px-4 lg:px-8 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="text-sm text-gray-600 flex items-center gap-4">
            <span>
              {items.length - unanswered}/{items.length} answered
            </span>
            {failures.length > 0 && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle size={14} />
                {failures.length} fail{failures.length === 1 ? "" : "s"}
                {criticalFailures.length > 0 && ` (${criticalFailures.length} critical — will auto-create WO)`}
              </span>
            )}
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUnstart}
              disabled={submitting}
              className="text-gray-600 hover:text-gray-800 text-sm px-3 py-2 rounded-md hover:bg-gray-100 disabled:opacity-50"
              title="Reset to pending (e.g. Start was clicked by mistake)"
            >
              Undo start
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-green-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit checklist"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function ItemRow({
  item,
  readOnly,
  onChange,
}: {
  item: ChecklistFormItem;
  readOnly: boolean;
  onChange: (patch: Partial<ChecklistFormItem>) => void;
}) {
  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-medium text-base text-gray-900">{item.label}</span>
            {item.isCritical && (
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">
                Critical
              </span>
            )}
          </div>
          {item.details && (
            <p className="text-sm text-gray-500 mt-1">{item.details}</p>
          )}
          {item.isCritical && item.escalationNote && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5 mt-2">
              <span className="font-semibold">Escalation:</span> {item.escalationNote}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-1 shrink-0 mt-3 sm:mt-0">
          <ResultButton
            active={item.result === "pass"}
            tone="green"
            icon={<CheckCircle2 size={18} />}
            label="Pass"
            disabled={readOnly}
            onClick={() => onChange({ result: "pass" })}
          />
          <ResultButton
            active={item.result === "fail"}
            tone="red"
            icon={<XCircle size={18} />}
            label="Fail"
            disabled={readOnly}
            onClick={() => onChange({ result: "fail" })}
          />
          <ResultButton
            active={item.result === "na"}
            tone="gray"
            icon={<MinusCircle size={18} />}
            label="N/A"
            disabled={readOnly}
            onClick={() => onChange({ result: "na" })}
          />
        </div>
      </div>

      {(item.inputType === "numeric" || item.inputType === "text") && (
        <div className="mt-3">
          <input
            type={item.inputType === "numeric" ? "text" : "text"}
            inputMode={item.inputType === "numeric" ? "decimal" : "text"}
            value={item.value}
            onChange={(e) => onChange({ value: e.target.value })}
            disabled={readOnly}
            placeholder={item.inputType === "numeric" ? "Reading / value" : "Enter value"}
            className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm disabled:bg-gray-50"
          />
        </div>
      )}

      {(item.result === "fail" || item.notes) && (
        <div className="mt-3">
          <textarea
            value={item.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            disabled={readOnly}
            placeholder="Notes (required on fail)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-base sm:text-sm disabled:bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}

function ResultButton({
  active,
  tone,
  icon,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  tone: "green" | "red" | "gray";
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const toneMap: Record<string, { active: string; idle: string }> = {
    green: {
      active: "bg-green-600 text-white border-green-600",
      idle: "text-green-700 border-green-200 hover:bg-green-50",
    },
    red: {
      active: "bg-red-600 text-white border-red-600",
      idle: "text-red-700 border-red-200 hover:bg-red-50",
    },
    gray: {
      active: "bg-gray-600 text-white border-gray-600",
      idle: "text-gray-700 border-gray-200 hover:bg-gray-50",
    },
  };
  const cls = active ? toneMap[tone].active : toneMap[tone].idle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2.5 min-h-[44px] rounded-md border-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}

function groupBySection(items: ChecklistFormItem[]) {
  const groups = new Map<string, ChecklistFormItem[]>();
  for (const item of items) {
    const key = item.section ?? "Checks";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([title, items]) => ({ title, items }));
}
