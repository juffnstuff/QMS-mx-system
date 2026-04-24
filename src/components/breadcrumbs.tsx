import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4 overflow-x-auto -mx-1">
      <Link
        href="/"
        className="hover:text-blue-600 transition-colors shrink-0 px-2 py-1.5 -my-1.5 rounded"
        aria-label="Home"
      >
        <Home size={14} />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1 shrink-0">
          <ChevronRight size={14} className="text-gray-300" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-blue-600 transition-colors px-1 py-1.5 -my-1.5 rounded"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium truncate max-w-[200px] px-1 py-1.5">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
