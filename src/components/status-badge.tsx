const statusStyles: Record<string, string> = {
  operational: "bg-green-100 text-green-800",
  needs_service: "bg-yellow-100 text-yellow-800",
  down: "bg-red-100 text-red-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  planning: "bg-blue-100 text-blue-800",
  on_hold: "bg-gray-100 text-gray-600",
  under_review: "bg-yellow-100 text-yellow-800",
  closed: "bg-green-100 text-green-800",
  investigating: "bg-purple-100 text-purple-800",
  dispositioned: "bg-teal-100 text-teal-800",
  aesthetic: "bg-gray-100 text-gray-800",
  dimensional: "bg-blue-100 text-blue-800",
  function: "bg-yellow-100 text-yellow-800",
  quality: "bg-orange-100 text-orange-800",
  safety: "bg-red-100 text-red-800",
  compliance: "bg-purple-100 text-purple-800",
  packaging: "bg-teal-100 text-teal-800",
  shipping_damage: "bg-red-100 text-red-800",
  other: "bg-gray-100 text-gray-600",
  pending_verification: "bg-purple-100 text-purple-800",
  planned: "bg-gray-100 text-gray-800",
  complete: "bg-green-100 text-green-800",
  verified: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  operational: "Operational",
  needs_service: "Needs Service",
  down: "Down",
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  planning: "Planning",
  on_hold: "On Hold",
  under_review: "Under Review",
  closed: "Closed",
  investigating: "Investigating",
  dispositioned: "Dispositioned",
  aesthetic: "Aesthetic",
  dimensional: "Dimensional",
  function: "Function",
  quality: "Quality",
  safety: "Safety",
  compliance: "Compliance",
  packaging: "Packaging",
  shipping_damage: "Shipping Damage",
  other: "Other",
  pending_verification: "Pending Verification",
  planned: "Planned",
  complete: "Complete",
  verified: "Verified",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusStyles[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
