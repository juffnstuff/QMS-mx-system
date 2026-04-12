"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  isAdmin: boolean;
}

export function ComplaintForm({ isAdmin }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      customerName: formData.get("customerName"),
      customerAddress: formData.get("customerAddress") || null,
      customerContact: formData.get("customerContact") || null,
      contactPhone: formData.get("contactPhone") || null,
      contactEmail: formData.get("contactEmail") || null,
      partNumber: formData.get("partNumber") || null,
      salesOrderNumber: formData.get("salesOrderNumber") || null,
      invoiced: formData.get("invoiced") || null,
      invoiceNumber: formData.get("invoiceNumber") || null,
      invoiceValue: formData.get("invoiceValue") || null,
      drawingNumber: formData.get("drawingNumber") || null,
      drawingRevision: formData.get("drawingRevision") || null,
      quantityAffected: formData.get("quantityAffected") || null,
      complaintType: formData.get("complaintType"),
      complaintDescription: formData.get("complaintDescription"),
      otherInfo: formData.get("otherInfo") || null,
      // Admin-only management disposition fields
      ...(isAdmin
        ? {
            disposition: formData.get("disposition") || null,
            rmaNumber: formData.get("rmaNumber") || null,
            customerFacingAction: formData.get("customerFacingAction") || null,
            internalAction: formData.get("internalAction") || null,
            ncrRequired: formData.get("ncrRequired") === "on",
            capaRequired: formData.get("capaRequired") === "on",
            affectsOtherOrders: formData.get("affectsOtherOrders") === "on",
            rootCauseRequired: formData.get("rootCauseRequired") === "on",
          }
        : {}),
    };

    const res = await fetch("/api/complaints", {
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

    router.push("/complaints");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl"
    >
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      {/* Section: Complaint Details */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Complaint Details</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name *
          </label>
          <input
            id="customerName"
            name="customerName"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Acme Corporation"
          />
        </div>

        <div>
          <label htmlFor="customerAddress" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Address
          </label>
          <textarea
            id="customerAddress"
            name="customerAddress"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Street, City, State, ZIP"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="customerContact" className="block text-sm font-medium text-gray-700 mb-1">
              Customer Contact
            </label>
            <input
              id="customerContact"
              name="customerContact"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Contact name"
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="contact@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Part # or Part Name
            </label>
            <input
              id="partNumber"
              name="partNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Part number or name"
            />
          </div>
          <div>
            <label htmlFor="salesOrderNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Sales Order #
            </label>
            <input
              id="salesOrderNumber"
              name="salesOrderNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SO-12345"
            />
          </div>
        </div>

        <div>
          <label htmlFor="invoiced" className="block text-sm font-medium text-gray-700 mb-1">
            Invoiced?
          </label>
          <select
            id="invoiced"
            name="invoiced"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Invoice #
            </label>
            <input
              id="invoiceNumber"
              name="invoiceNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="INV-12345"
            />
          </div>
          <div>
            <label htmlFor="invoiceValue" className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Value
            </label>
            <input
              id="invoiceValue"
              name="invoiceValue"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="$0.00"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="drawingNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Drawing #
            </label>
            <input
              id="drawingNumber"
              name="drawingNumber"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="DWG-001"
            />
          </div>
          <div>
            <label htmlFor="drawingRevision" className="block text-sm font-medium text-gray-700 mb-1">
              Rev
            </label>
            <input
              id="drawingRevision"
              name="drawingRevision"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="A"
            />
          </div>
          <div>
            <label htmlFor="quantityAffected" className="block text-sm font-medium text-gray-700 mb-1">
              Qty Affected
            </label>
            <input
              id="quantityAffected"
              name="quantityAffected"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label htmlFor="complaintType" className="block text-sm font-medium text-gray-700 mb-1">
            Complaint Type *
          </label>
          <select
            id="complaintType"
            name="complaintType"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select complaint type...</option>
            <option value="aesthetic">Aesthetic</option>
            <option value="dimensional">Dimensional</option>
            <option value="function">Function</option>
            <option value="quality">Quality</option>
            <option value="safety">Safety</option>
            <option value="compliance">Compliance</option>
            <option value="packaging">Packaging</option>
            <option value="shipping_damage">Shipping Damage</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="complaintDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Detailed Description of the Complaint *
          </label>
          <textarea
            id="complaintDescription"
            name="complaintDescription"
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe the complaint in detail..."
          />
        </div>

        <div>
          <label htmlFor="otherInfo" className="block text-sm font-medium text-gray-700 mb-1">
            Other Information
          </label>
          <textarea
            id="otherInfo"
            name="otherInfo"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Any additional information..."
          />
        </div>
      </div>

      {/* Section: Management Disposition (admin-only) */}
      {isAdmin && (
        <>
          <div className="border-t border-gray-200 mt-6 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Management Disposition</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="disposition" className="block text-sm font-medium text-gray-700 mb-1">
                  Recommended Disposition
                </label>
                <select
                  id="disposition"
                  name="disposition"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select disposition...</option>
                  <option value="return_rework">Return & Rework</option>
                  <option value="return_credit">Return & Credit</option>
                  <option value="return_refund">Return & Refund</option>
                  <option value="replace_no_charge">Replace No Charge</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="rmaNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  RMA #
                </label>
                <input
                  id="rmaNumber"
                  name="rmaNumber"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="RMA-12345"
                />
              </div>

              <div>
                <label htmlFor="customerFacingAction" className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Facing Action
                </label>
                <textarea
                  id="customerFacingAction"
                  name="customerFacingAction"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Action to communicate to the customer..."
                />
              </div>

              <div>
                <label htmlFor="internalAction" className="block text-sm font-medium text-gray-700 mb-1">
                  Internal Action Required
                </label>
                <textarea
                  id="internalAction"
                  name="internalAction"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Internal corrective actions..."
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="ncrRequired"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">NCR Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="capaRequired"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">CAPA Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="affectsOtherOrders"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Affects Other Orders</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="rootCauseRequired"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Root Cause Investigation Required</span>
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {loading ? "Submitting..." : "Submit Complaint"}
        </button>
        <Link href="/complaints" className="text-gray-600 hover:text-gray-800 text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}
