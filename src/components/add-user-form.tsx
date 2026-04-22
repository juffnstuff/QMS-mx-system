"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";

export function AddUserForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    };

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Something went wrong");
      setLoading(false);
      return;
    }

    setSuccess("User created.");
    setLoading(false);
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {success || "Add someone new to the team."}
        </p>
        <button
          onClick={() => {
            setOpen(true);
            setError("");
            setSuccess("");
          }}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <UserPlus size={16} />
          Add New User
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      autoComplete="off"
      // Browsers ignore autoComplete="off" on password forms; we use field-level
      // hints ("new-password", "given-name", "family-name") to steer them away
      // from filling the admin's login credentials into this admin-only form.
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">New user details</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
            setSuccess("");
          }}
          className="text-gray-400 hover:text-gray-600 inline-flex items-center justify-center min-w-[32px] min-h-[32px]"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          name="firstName"
          required
          placeholder="First name"
          autoComplete="given-name"
          className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="lastName"
          required
          placeholder="Last name"
          autoComplete="family-name"
          className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email address"
          autoComplete="off"
          className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Temporary password"
          autoComplete="new-password"
          className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="role"
          defaultValue="operator"
          className="px-3 py-2 border border-gray-300 rounded-md text-base sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? "Adding..." : "Add User"}
        </button>
      </div>
    </form>
  );
}
