import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { computeKpis, type KpiValue, type PmComplianceBreakdown } from "@/lib/kpis/compute";

export default async function KpisPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await computeKpis(30);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={22} /> KPI Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            PM compliance, work order, and overdue metrics — last {report.windowDays} days.
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
          Operational KPIs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiTile kpi={report.openWorkOrders} />
          <KpiTile kpi={report.overdueCriticalWorkOrders} />
          <KpiTile kpi={report.overdueMaintenance} />
          <KpiTile kpi={report.overduePmCompletions} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
          PM Compliance by Equipment Class
        </h2>
        {report.compliance.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-500">
            No PM completions in the last {report.windowDays} days. Once the
            nightly cron generates completions and techs submit them, compliance
            tiles will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.compliance.map((row) => (
              <ComplianceTile key={row.equipmentClass ?? "uncat"} row={row} />
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Compliance formula: (Completed + Superseded) ÷ Scheduled. Superseded
          daily checklists count as completed when covered by the corresponding
          weekly / monthly PM.
        </p>
      </section>
    </div>
  );
}

function KpiTile({ kpi }: { kpi: KpiValue }) {
  const Icon = kpi.passing ? CheckCircle2 : XCircle;
  const color = kpi.passing ? "text-green-600" : "text-red-600";
  const bg = kpi.passing ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{kpi.label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{kpi.actual}</p>
          <p className="text-xs text-gray-500 mt-1">Target: {kpi.target}</p>
        </div>
        <Icon size={20} className={color} />
      </div>
      {kpi.detail && <p className="text-xs text-gray-500 mt-2">{kpi.detail}</p>}
    </div>
  );
}

function ComplianceTile({ row }: { row: PmComplianceBreakdown }) {
  const percent = row.percent;
  const passing = percent !== null && percent >= row.target;
  const color =
    percent === null
      ? "text-gray-400"
      : passing
      ? "text-green-600"
      : percent >= row.target * 0.8
      ? "text-amber-600"
      : "text-red-600";
  const barColor =
    percent === null
      ? "bg-gray-200"
      : passing
      ? "bg-green-500"
      : percent >= row.target * 0.8
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{row.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">Target ≥ {row.target}%</p>
        </div>
        <div className={`text-2xl font-bold ${color}`}>
          {percent === null ? "—" : `${percent}%`}
        </div>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: percent === null ? "0%" : `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
        <div>
          <p className="text-gray-400">Scheduled</p>
          <p className="font-semibold text-gray-800">{row.scheduled}</p>
        </div>
        <div>
          <p className="text-gray-400">Completed</p>
          <p className="font-semibold text-green-700">{row.completed}</p>
        </div>
        <div>
          <p className="text-gray-400">Superseded</p>
          <p className="font-semibold text-gray-600">{row.superseded}</p>
        </div>
        <div>
          <p className="text-gray-400">Missed</p>
          <p className={`font-semibold ${row.missed > 0 ? "text-red-600" : "text-gray-600"}`}>
            {row.missed}
          </p>
        </div>
      </div>
      {row.missed > 0 && (
        <div className="mt-2 flex items-start gap-1 text-xs text-red-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>Missed PMs require a written explanation per P-19.</span>
        </div>
      )}
    </div>
  );
}
