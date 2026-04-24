"use client";

import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, X } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserPickerProps {
  users: UserOption[];
  value: string;
  onChange: (userId: string) => void;
  label: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
}

export function UserPicker({
  users,
  value,
  onChange,
  label,
  name,
  required = false,
  placeholder = "Select a user...",
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = users.find((u) => u.id === value);
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
              {selected.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-gray-400 flex items-center gap-2">
            <User size={16} />
            {placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              className="p-0.5 rounded hover:bg-gray-100"
            >
              <X size={14} className="text-gray-400" />
            </span>
          )}
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">No users found</p>
            ) : (
              filtered.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onChange(user.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    user.id === value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="text-left truncate">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  {user.role === "admin" && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">
                      Admin
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
