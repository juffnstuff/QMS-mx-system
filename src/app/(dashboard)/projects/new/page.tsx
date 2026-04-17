import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/projects");

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Project</h1>
      <ProjectForm users={users} />
    </div>
  );
}
