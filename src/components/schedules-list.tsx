"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { ScheduleRowActions } from "./schedule-row-actions";

interface ScheduleRow {
  id: string;
  equipmentId: string;
  title: string;
  description: string | null;
  frequency: string;
  nextDue: string | Date;
  boardStatus: string;
  checklistTemplateId: string | null;
  equipment: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
}

type Filter = "all" | "checklist" | "vendor";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "checklist", label: "Checklist-driven" },
  { key: "vendor", label: "Other / Vendor" },
];

export function SchedulesList({
  schedules,
  isAdmin,
}: {
  schedules: ScheduleRow[];
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    if (filter === "checklist") return schedules.filter((s) => s.checklistTemplateId);
    if (filter === "vendor") return schedules.filter((s) => !s.checklistTemplateId);
    return schedules;
  }, [schedules, filter]);

  const now = new Date();
  const overdueSchedules = visible.filter((s) => new Date(s.nextDue) < now);
  const upcomingSchedules = visible.filter((s) => new Date(s.nextDue) >= now);

  const counts: Record<Filter, number> = {
    all: schedules.length,
    checklist: schedules.filter((s) => s.checklistTemplateId).length,
    vendor: schedules.filter((s) => !s.checklistTemplateId).length,
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
              <span
                className={`text-xs font-semibold rounded-full px-1.5 ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
          <p>
            No {filter === "all" ? "" : filter === "checklist" ? "checklist-driven " : "other / vendor "}
            schedules.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdueSchedules.length > 0 && (
            <SectionGroup
              title={`Overdue (${overdueSchedules.length})`}
              tone="red"
            >
              {overdueSchedules.map((schedule) => (
                <Row key={schedule.id} schedule={schedule} isAdmin={isAdmin} overdue />
              ))}
            </SectionGroup>
          )}
          {upcomingSchedules.length > 0 && (
            <SectionGroup
              title={`Upcoming (${upcomingSchedules.length})`}
              tone="gray"
            >
              {upcomingSchedules.map((schedule) => (
                <Row key={schedule.id} schedule={schedule} isAdmin={isAdmin} now={now} />
              ))}
            </SectionGroup>
          )}
        </div>
      )}
    </div>
  );
}

function SectionGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "red" | "gray";
  children: React.ReactNode;
}) {
  const headerColor = tone === "red" ? "text-red-600" : "text-gray-500";
  const borderColor = tone === "red" ? "border-red-200" : "border-gray-200";
  const divideColor = tone === "red" ? "divide-red-100" : "divide-gray-100";
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${headerColor}`}>
        {title}
      </h2>
      <div className={`bg-white rounded-lg shadow-sm border ${borderColor}`}>
        <div className={`divide-y ${divideColor}`}>{children}</div>
      </div>
    </div>
  );
}

function Row({
  schedule,
  isAdmin,
  overdue,
  now,
}: {
  schedule: ScheduleRow;
  isAdmin: boolean;
  overdue?: boolean;
  now?: Date;
}) {
  const isChecklist = !!schedule.checklistTemplateId;
  const detailHref = isChecklist ? "/checklists" : `/schedules/${schedule.id}`;
  const daysUntil = now
    ? Math.ceil((new Date(schedule.nextDue).getTime() - now.getTime()) / 86400000)
    : 0;

  return (
    <div
      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        overdue ? "bg-red-50/50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={detailHref}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {schedule.title}
          </Link>
          {isChecklist ? (
            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              PM Checklist
            </span>
          ) : (
            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Other / Vendor
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          <Link href={`/equipment/${schedule.equipmentId}`} className="text-blue-600 hover:text-blue-800">
            {schedule.equipment.name}
          </Link>
          {" "}&bull; <span className="capitalize">{schedule.frequency}</span>
          {schedule.assignedTo && <>{" "}&bull; {schedule.assignedTo.name}</>}
        </p>
        {schedule.description && (
          <p className="text-sm text-gray-400 mt-0.5">{schedule.description}</p>
        )}
      </div>
      <div className="flex flex-col sm:items-end gap-2 shrink-0">
        <div className="text-left sm:text-right">
          {overdue ? (
            <>
              <p className="text-sm font-semibold text-red-600">OVERDUE</p>
              <p className="text-sm text-red-500">
                Was due {new Date(schedule.nextDue).toLocaleDateString()}
              </p>
            </>
          ) : (
            <>
              <p
                className={`text-sm font-medium ${daysUntil <= 3 ? "text-orange-600" : "text-gray-600"}`}
              >
                {daysUntil === 0
                  ? "Due today"
                  : daysUntil === 1
                  ? "Due tomorrow"
                  : `Due in ${daysUntil} days`}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(schedule.nextDue).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
        {isAdmin && !isChecklist && (
          <ScheduleRowActions
            scheduleId={schedule.id}
            scheduleTitle={schedule.title}
            currentStatus={schedule.boardStatus}
          />
        )}
      </div>
    </div>
  );
}
