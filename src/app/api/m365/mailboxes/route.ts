import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveConnection, getGraphClient } from "@/lib/m365/graph-client";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const connection = await getActiveConnection();
  if (!connection) {
    return NextResponse.json({ error: "MS365 not connected" }, { status: 400 });
  }

  try {
    const client = await getGraphClient(connection.id);

    // Get the current user's mailbox info
    const me = await client.api("/me").select("displayName,mail").get();

    // Try to list shared mailboxes (requires appropriate permissions)
    let sharedMailboxes: { displayName: string; mail: string }[] = [];
    try {
      const shared = await client
        .api("/users")
        .filter("accountEnabled eq true")
        .select("displayName,mail,userType")
        .top(50)
        .get();
      sharedMailboxes = (shared.value || [])
        .filter((u: { mail: string }) => u.mail)
        .map((u: { displayName: string; mail: string }) => ({
          displayName: u.displayName,
          mail: u.mail,
        }));
    } catch {
      // May not have permission to list users — just return current user
    }

    return NextResponse.json({
      currentUser: { displayName: me.displayName, mail: me.mail },
      availableMailboxes: sharedMailboxes,
    });
  } catch (error) {
    console.error("[M365 Mailboxes] Error:", error);
    return NextResponse.json({ error: "Failed to fetch mailboxes" }, { status: 500 });
  }
}
