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

    // List teams the connected user is a member of
    const teamsResponse = await client.api("/me/joinedTeams").select("id,displayName").get();
    const teams = teamsResponse.value || [];

    // For each team, list channels
    const teamsWithChannels = await Promise.all(
      teams.map(async (team: { id: string; displayName: string }) => {
        try {
          const channelsResponse = await client
            .api(`/teams/${team.id}/channels`)
            .select("id,displayName")
            .get();
          return {
            id: team.id,
            displayName: team.displayName,
            channels: (channelsResponse.value || []).map(
              (ch: { id: string; displayName: string }) => ({
                id: ch.id,
                displayName: ch.displayName,
              })
            ),
          };
        } catch {
          return { id: team.id, displayName: team.displayName, channels: [] };
        }
      })
    );

    return NextResponse.json({ teams: teamsWithChannels });
  } catch (error) {
    console.error("[M365 Teams] Error:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
