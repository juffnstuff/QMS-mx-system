import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NCRForm } from "@/components/ncr-form";

export default async function NewNCRPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Non-Conformance Report</h1>
      <NCRForm isAdmin={session?.user.role === "admin"} users={users} />
    </div>
  );
}
