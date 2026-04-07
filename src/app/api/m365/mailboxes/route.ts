import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConnection, getGraphClient } from "@/lib/m365/graph-client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const connection = await getUserConnection(session.user.id);
  if (!connection) {
    return NextResponse.json({ error: "MS365 not connected" }, { status: 400 });
  }

  try {
    const client = await getGraphClient(connection.id);
    const me = await client.api("/me").select("displayName,mail").get();

    return NextResponse.json({
      currentUser: { displayName: me.displayName, mail: me.mail },
    });
  } catch (error) {
    console.error("[M365 Mailboxes] Error:", error);
    return NextResponse.json({ error: "Failed to fetch mailbox info" }, { status: 500 });
  }
}
