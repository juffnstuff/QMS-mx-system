import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { WorkOrderForm } from "@/components/work-order-form";

export default async function NewWorkOrderPage() {
  const session = await auth();

  const [equipment, users] = await Promise.all([
    prisma.equipment.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Work Order</h1>
      <WorkOrderForm
        equipment={equipment}
        users={users}
        isAdmin={session?.user.role === "admin"}
      />
    </div>
  );
}
