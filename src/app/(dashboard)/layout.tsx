import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { prisma } from "@/lib/prisma";
import { ToastProvider } from "@/components/toast-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={session.user.name} userRole={session.user.role} unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </main>
    </div>
  );
}
