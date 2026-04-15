"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { Calendar, User, ArrowRightLeft } from "lucide-react";

export type EntityType = "workOrder" | "maintenanceSchedule" | "nonConformance" | "capa" | "project";

export interface KanbanCardData {
  id: string;
  entityType: EntityType;
  title: string;
  subtitle: string;
  assigneeName?: string | null;
  dueDate?: string | null;
  href: string;
  priority?: string | null;
}

const TYPE_STYLES: Record<EntityType, { label: string; bg: string; text: string; dot: string }> = {
  workOrder: { label: "Work Order", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  maintenanceSchedule: { label: "Maintenance", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  nonConformance: { label: "NCR", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  capa: { label: "CAPA", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  project: { label: "Project", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-400",
  low: "bg-gray-400",
};

const COLUMN_OPTIONS = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "needs_parts", label: "Needs Parts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "done", label: "Done" },
];

interface KanbanCardProps {
  card: KanbanCardData;
  currentColumn?: string;
  onMoveCard?: (cardKey: string, targetColumn: string) => void;
}

export function KanbanCard({ card, currentColumn, onMoveCard }: KanbanCardProps) {
  const router = useRouter();
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${card.entityType}::${card.id}`,
    data: { card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const typeStyle = TYPE_STYLES[card.entityType];

  // Track pointer start so we can distinguish click from drag
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  // Navigate only if pointer didn't move (was a click, not a drag)
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const start = pointerStart.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > 5 || dy > 5) return; // was a drag attempt
    }
    e.stopPropagation();
    router.push(card.href);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-md transition-all select-none ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-blue-400" : ""
      }`}
    >
      {/* Type badge + priority dot + move button */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
          {typeStyle.label}
        </span>
        {card.priority && (
          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[card.priority] || "bg-gray-300"}`} title={`Priority: ${card.priority}`} />
        )}

        {/* Mobile move button */}
        {onMoveCard && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMoveMenu(!showMoveMenu);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="ml-auto sm:hidden p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
            title="Move to..."
          >
            <ArrowRightLeft size={14} />
          </button>
        )}
      </div>

      {/* Mobile move menu */}
      {showMoveMenu && onMoveCard && (
        <div className="sm:hidden flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          {COLUMN_OPTIONS.map((col) => (
            <button
              key={col.id}
              disabled={col.id === currentColumn}
              onClick={(e) => {
                e.stopPropagation();
                onMoveCard(`${card.entityType}::${card.id}`, col.id);
                setShowMoveMenu(false);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                col.id === currentColumn
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100"
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
        {card.title}
      </p>

      {/* Subtitle */}
      <p className="text-xs text-gray-500 truncate mb-2">
        {card.subtitle}
      </p>

      {/* Footer: assignee + due date */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        {card.assigneeName ? (
          <span className="flex items-center gap-1 truncate">
            <User size={12} />
            <span className="truncate">{card.assigneeName}</span>
          </span>
        ) : (
          <span className="text-gray-300 italic">Unassigned</span>
        )}
        {card.dueDate && (
          <span className="flex items-center gap-1 shrink-0">
            <Calendar size={12} />
            {new Date(card.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}
