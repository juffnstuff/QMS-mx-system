import Link from "next/link";

interface FormActionsProps {
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
  cancelHref: string;
  deleteButton?: React.ReactNode;
}

export function FormActions({
  loading,
  submitLabel,
  loadingLabel,
  cancelHref,
  deleteButton,
}: FormActionsProps) {
  return (
    <div className="flex items-center gap-3 py-4 border-t border-gray-200">
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {loading ? loadingLabel : submitLabel}
      </button>
      <Link href={cancelHref} className="text-gray-600 hover:text-gray-800 text-sm">
        Cancel
      </Link>
      {deleteButton && <div className="ml-auto">{deleteButton}</div>}
    </div>
  );
}
