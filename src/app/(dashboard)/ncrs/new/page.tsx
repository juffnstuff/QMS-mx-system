import { auth } from "@/lib/auth";
import { NCRForm } from "@/components/ncr-form";

export default async function NewNCRPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Non-Conformance Report</h1>
      <NCRForm isAdmin={session?.user.role === "admin"} />
    </div>
  );
}
