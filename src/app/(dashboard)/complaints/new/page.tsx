import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ComplaintForm } from "@/components/complaint-form";

export default async function NewComplaintPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Customer Complaint</h1>
      <ComplaintForm isAdmin={session?.user.role === "admin"} users={users} />
    </div>
  );
}
