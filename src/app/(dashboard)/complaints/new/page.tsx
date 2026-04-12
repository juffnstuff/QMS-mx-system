import { auth } from "@/lib/auth";
import { ComplaintForm } from "@/components/complaint-form";

export default async function NewComplaintPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Customer Complaint</h1>
      <ComplaintForm isAdmin={session?.user.role === "admin"} />
    </div>
  );
}
