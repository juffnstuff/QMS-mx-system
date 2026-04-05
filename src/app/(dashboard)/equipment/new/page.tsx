import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EquipmentForm } from "@/components/equipment-form";

export default async function NewEquipmentPage() {
  const session = await auth();
  if (session?.user.role !== "admin") redirect("/equipment");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Equipment</h1>
      <EquipmentForm />
    </div>
  );
}
