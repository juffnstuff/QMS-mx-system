import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveConnection, getGraphClient } from "@/lib/m365/graph-client";
import { pollMailbox, type RawMessage } from "@/lib/m365/mail-poller";
import { pollTeamsChannel } from "@/lib/m365/teams-poller";
import { analyzeMessage } from "@/lib/ai/analyze-message";

const AUTO_APPLY_THRESHOLD = 0.92;

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await getActiveConnection();
  if (!connection) {
    return NextResponse.json({ message: "No active M365 connection" });
  }

  const monitors = await prisma.m365MonitorConfig.findMany({
    where: { isActive: true },
  });

  if (monitors.length === 0) {
    return NextResponse.json({ message: "No active monitors" });
  }

  // Load equipment list for AI analysis
  const equipment = await prisma.equipment.findMany({
    select: { id: true, name: true, type: true, location: true, serialNumber: true, status: true },
  });

  let totalProcessed = 0;
  let totalSuggestions = 0;
  let totalAutoApplied = 0;

  const graphClient = await getGraphClient(connection.id);

  for (const monitor of monitors) {
    try {
      let messages: RawMessage[];

      if (monitor.sourceType === "mailbox") {
        messages = await pollMailbox(graphClient, monitor.id);
      } else {
        messages = await pollTeamsChannel(graphClient, monitor.id);
      }

      // Process max 20 messages per cycle
      for (const msg of messages.slice(0, 20)) {
        // Analyze with Claude
        const analysis = await analyzeMessage(
          {
            subject: msg.subject,
            body: msg.bodyContent,
            senderName: msg.senderName,
            senderEmail: msg.senderEmail,
          },
          equipment
        );

        // Store processed message
        const processed = await prisma.processedMessage.create({
          data: {
            externalId: msg.externalId,
            sourceType: monitor.sourceType === "mailbox" ? "email" : "teams",
            sourceId: monitor.sourceId,
            subject: msg.subject,
            senderName: msg.senderName,
            senderEmail: msg.senderEmail,
            bodyPreview: msg.bodyPreview,
            receivedAt: msg.receivedAt,
            aiAnalysis: JSON.stringify(analysis),
            actionTaken: analysis.relevant
              ? analysis.suggestedActions[0]?.type || "ignored"
              : "ignored",
            confidence: analysis.confidence,
          },
        });

        totalProcessed++;

        if (!analysis.relevant || analysis.suggestedActions.length === 0) continue;

        // Create suggestions
        for (const action of analysis.suggestedActions) {
          const shouldAutoApply =
            analysis.confidence >= AUTO_APPLY_THRESHOLD &&
            action.type === "create_work_order";

          const suggestion = await prisma.aISuggestion.create({
            data: {
              processedMessageId: processed.id,
              suggestionType: action.type,
              status: shouldAutoApply ? "auto_applied" : "pending",
              payload: JSON.stringify(action),
            },
          });

          totalSuggestions++;

          // Auto-apply high-confidence work orders
          if (shouldAutoApply) {
            try {
              // Find a default admin user for createdById
              const adminUser = await prisma.user.findFirst({
                where: { role: "admin" },
              });
              if (adminUser) {
                const workOrder = await prisma.workOrder.create({
                  data: {
                    equipmentId: action.equipmentId,
                    createdById: adminUser.id,
                    title: action.title,
                    description: `[Auto-created by AI from ${monitor.sourceType === "mailbox" ? "email" : "Teams"}]\n\n${action.description}`,
                    priority: action.priority || "medium",
                  },
                });

                await prisma.aISuggestion.update({
                  where: { id: suggestion.id },
                  data: {
                    createdRecordType: "WorkOrder",
                    createdRecordId: workOrder.id,
                  },
                });

                totalAutoApplied++;
              }
            } catch (err) {
              console.error("[Cron] Auto-apply failed:", err);
              // Revert to pending if auto-apply fails
              await prisma.aISuggestion.update({
                where: { id: suggestion.id },
                data: { status: "pending" },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Cron] Error processing monitor ${monitor.id}:`, error);
    }
  }

  return NextResponse.json({
    success: true,
    processed: totalProcessed,
    suggestions: totalSuggestions,
    autoApplied: totalAutoApplied,
  });
}
