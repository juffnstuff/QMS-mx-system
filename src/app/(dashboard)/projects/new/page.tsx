import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/projects");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Project</h1>
      <ProjectForm />
    </div>
  );
}
