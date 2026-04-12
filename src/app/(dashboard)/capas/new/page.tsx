import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CAPAForm } from "@/components/capa-form";

export default async function NewCAPAPage() {
  const session = await auth();

  const [users, ncrs] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.nonConformance.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, ncrNumber: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create CAPA</h1>
      <CAPAForm
        users={users}
        ncrs={ncrs}
        isAdmin={session?.user.role === "admin"}
      />
    </div>
  );
}
