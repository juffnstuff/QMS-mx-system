const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(title: string, body: string, link?: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1f2937; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 16px;">QMS Tracker — RubberForm</h2>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
        <h3 style="margin: 0 0 12px; color: #111827;">${title}</h3>
        <div style="color: #4b5563; font-size: 14px; line-height: 1.6;">${body}</div>
        ${link ? `<div style="margin-top: 16px;"><a href="${link}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View in QMS</a></div>` : ""}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 12px; text-align: center;">
        QMS Tracker &middot; RubberForm Recycled Products
      </p>
    </div>
  `.trim();
}

export function workOrderAssigned(title: string, assigneeName: string, workOrderId: string) {
  const link = `${BASE_URL}/work-orders/${workOrderId}`;
  return {
    subject: `Work Order Assigned: ${title}`,
    html: wrap(
      `Work Order Assigned to You`,
      `<p>Hi ${assigneeName},</p><p>You've been assigned a work order: <strong>${title}</strong></p>`,
      link
    ),
    plain: `Work order assigned to you: ${title}. View at ${link}`,
  };
}

export function statusChanged(title: string, oldStatus: string, newStatus: string, workOrderId: string) {
  const link = `${BASE_URL}/work-orders/${workOrderId}`;
  return {
    subject: `Work Order Updated: ${title}`,
    html: wrap(
      `Work Order Status Changed`,
      `<p>Work order <strong>${title}</strong> changed from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>`,
      link
    ),
    plain: `Work order "${title}" changed from ${oldStatus} to ${newStatus}. View at ${link}`,
  };
}

export function suggestionsNeedReview(count: number) {
  const link = `${BASE_URL}/settings/m365/suggestions`;
  return {
    subject: `${count} AI Suggestion${count !== 1 ? "s" : ""} Need Review`,
    html: wrap(
      `AI Suggestions Need Review`,
      `<p>${count} new AI suggestion${count !== 1 ? "s" : ""} from email scanning ${count !== 1 ? "are" : "is"} awaiting your review.</p>`,
      link
    ),
    plain: `${count} new AI suggestions need review. View at ${link}`,
  };
}

export function maintenanceDue(schedules: { title: string; equipmentName: string }[]) {
  const link = `${BASE_URL}/schedules`;
  const list = schedules
    .map((s) => `<li><strong>${s.title}</strong> — ${s.equipmentName}</li>`)
    .join("");
  return {
    subject: `${schedules.length} Maintenance Task${schedules.length !== 1 ? "s" : ""} Due/Overdue`,
    html: wrap(
      `Maintenance Due`,
      `<p>${schedules.length} maintenance task${schedules.length !== 1 ? "s are" : " is"} due or overdue:</p><ul>${list}</ul>`,
      link
    ),
    plain: `${schedules.length} maintenance tasks due/overdue: ${schedules.map((s) => s.title).join(", ")}. View at ${link}`,
  };
}
