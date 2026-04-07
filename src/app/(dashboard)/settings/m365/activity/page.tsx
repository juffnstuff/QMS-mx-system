import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ActivityItem } from "@/components/m365/activity-item";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const messages = await prisma.processedMessage.findMany({
    include: {
      suggestions: {
        include: { reviewer: { select: { name: true } } },
      },
    },
    orderBy: { processedAt: "desc" },
    take: 50,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/settings/m365" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Connector
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Connector Activity</h1>
          <p className="text-sm text-gray-500 mt-1">
            Recent messages processed by the AI connector
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No activity yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Messages will appear here once the connector starts polling
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <ActivityItem key={msg.id} message={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
