import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { startOfEasternDay, easternYmd, EASTERN_TZ } from "@/lib/pm-checklists/eastern-time";

export default async function ChecklistsPage() {
  const session = await auth();

  const [pendingToday, inProgress, recentCompleted] = await Promise.all([
    prisma.checklistCompletion.findMany({
      where: { status: "pending" },
      include: {
        template: { select: { name: true, frequency: true } },
        equipment: { select: { name: true, serialNumber: true, criticality: true } },
        technician: { select: { name: true } },
        schedule: { select: { lastDone: true } },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: 100,
    }),
    prisma.checklistCompletion.findMany({
      where: { status: "in_progress" },
      include: {
        template: { select: { name: true, frequency: true } },
        equipment: { select: { name: true, serialNumber: true, criticality: true } },
        technician: { select: { name: true } },
        schedule: { select: { lastDone: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.checklistCompletion.findMany({
      where: { status: { in: ["completed", "superseded"] } },
      include: {
        template: { select: { name: true, frequency: true } },
        equipment: { select: { name: true, serialNumber: true } },
        technician: { select: { name: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
  ]);

  const now = new Date();
  const easternToday = startOfEasternDay(now);
  const overdue = pendingToday.filter((c) => new Date(c.scheduledFor) < easternToday);
  const dueToday = pendingToday.filter((c) => !overdue.includes(c));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={24} />
          PM Checklists
        </h1>
      </div>

      {overdue.length > 0 && (
        <Section
          title={`Overdue (${overdue.length})`}
          tone="red"
          icon={<AlertTriangle size={16} />}
        >
          {overdue.map((c) => (
            <CompletionRow key={c.id} completion={c} isOverdue />
          ))}
        </Section>
      )}

      {inProgress.length > 0 && (
        <Section title={`In progress (${inProgress.length})`} tone="blue">
          {inProgress.map((c) => (
            <CompletionRow key={c.id} completion={c} />
          ))}
        </Section>
      )}

      <Section title={`Due today (${dueToday.length})`} tone="gray">
        {dueToday.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No checklists pending. The nightly cron will create tomorrow&apos;s at 05:00 Eastern.
          </div>
        ) : (
          dueToday.map((c) => <CompletionRow key={c.id} completion={c} />)
        )}
      </Section>

      <Section
        title={`Recently completed (${recentCompleted.length})`}
        tone="green"
        icon={<CheckCircle2 size={16} />}
      >
        {recentCompleted.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">None yet.</div>
        ) : (
          recentCompleted.map((c) => <CompletionRow key={c.id} completion={c} compact />)
        )}
      </Section>

      {session?.user.role === "admin" && (
        <div className="mt-8 text-xs text-gray-500">
          Admin: templates seeded via <code>/api/seed-pm-checklists?key=...</code>. Daily generator runs at 05:00 Eastern via the cron scheduler.
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  icon,
  children,
}: {
  title: string;
  tone: "red" | "blue" | "gray" | "green";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneMap = {
    red: "text-red-600 border-red-200",
    blue: "text-blue-600 border-blue-200",
    gray: "text-gray-600 border-gray-200",
    green: "text-green-600 border-green-200",
  };
  return (
    <div className="mb-6">
      <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${toneMap[tone].split(" ")[0]}`}>
        {icon}
        {title}
      </h2>
      <div className={`bg-white rounded-lg shadow-sm border ${toneMap[tone].split(" ")[1]} divide-y divide-gray-100`}>
        {children}
      </div>
    </div>
  );
}

type CompletionRowProps = {
  completion: {
    id: string;
    status: string;
    scheduledFor: Date;
    completedAt: Date | null;
    template: { name: string; frequency: string } | null;
    equipment: { name: string; serialNumber: string; criticality?: string } | null;
    technician: { name: string } | null;
    schedule?: { lastDone: Date | null } | null;
  };
  isOverdue?: boolean;
  compact?: boolean;
};

function CompletionRow({ completion, isOverdue, compact }: CompletionRowProps) {
  const tpl = completion.template;
  const eq = completion.equipment;
  const tech = completion.technician;
  const lastDone = completion.schedule?.lastDone
    ? new Date(completion.schedule.lastDone)
    : null;
  const daysAgo = lastDone
    ? Math.max(0, Math.floor((Date.now() - lastDone.getTime()) / 86400000))
    : null;
  return (
    <Link
      href={`/checklists/${completion.id}`}
      className={`block p-4 hover:bg-gray-50 transition-colors ${isOverdue ? "bg-red-50/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {tpl?.name ?? "—"}
            {eq?.criticality === "A" && (
              <span className="ml-2 text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                CLASS A
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-0.5 truncate">
            {eq ? `${eq.name} (${eq.serialNumber})` : "—"}
            {" · "}
            <span className="capitalize">{tpl?.frequency}</span>
            {tech && ` · ${tech.name}`}
          </div>
          {!compact && daysAgo !== null && (completion.status === "pending" || completion.status === "in_progress") && (
            <div className="text-xs text-amber-700 mt-1">
              {daysAgo === 0
                ? "Completed earlier today"
                : `${daysAgo} day${daysAgo === 1 ? "" : "s"} since last completion`}
            </div>
          )}
          {!compact && daysAgo === null && (completion.status === "pending" || completion.status === "in_progress") && (
            <div className="text-xs text-gray-400 mt-1">First run — no prior completion on record</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
            {compact && completion.completedAt
              ? new Date(completion.completedAt).toLocaleString("en-US", { timeZone: EASTERN_TZ })
              : formatDue(completion.scheduledFor)}
          </div>
          {!compact && (
            <div className="text-xs text-gray-400 mt-0.5 capitalize">{completion.status.replace("_", " ")}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatDue(d: Date | string): string {
  const date = new Date(d);
  const now = new Date();
  if (easternYmd(date) === easternYmd(now)) return "Today";
  return date.toLocaleDateString("en-US", { timeZone: EASTERN_TZ });
}
