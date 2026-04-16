const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(title: string, body: string, link?: string, accent = "#1f2937"): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${accent}; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
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

export function workOrderCreated(title: string, equipmentName: string, priority: string, workOrderId: string) {
  const link = `${BASE_URL}/work-orders/${workOrderId}`;
  return {
    subject: `New Work Order: ${title}`,
    html: wrap(
      `Work Order Created`,
      `<p>A new work order was created:</p><ul><li><strong>${title}</strong></li><li>Equipment: ${equipmentName}</li><li>Priority: ${priority}</li></ul>`,
      link
    ),
    plain: `New work order "${title}" on ${equipmentName} (${priority}). View at ${link}`,
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

export function equipmentDown(equipmentName: string, location: string, notes: string | null, equipmentId: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  return {
    subject: `URGENT: Equipment Down — ${equipmentName}`,
    html: wrap(
      `Equipment Down`,
      `<p style="color: #b91c1c; font-weight: 600;">${equipmentName} has been marked DOWN.</p><p>Location: ${location}</p>${notes ? `<p>Notes: ${notes}</p>` : ""}<p>Immediate attention required.</p>`,
      link,
      "#b91c1c"
    ),
    plain: `URGENT: ${equipmentName} at ${location} is DOWN. ${notes || ""} View at ${link}`.trim(),
  };
}

export function equipmentStatusChanged(equipmentName: string, oldStatus: string, newStatus: string, equipmentId: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  return {
    subject: `Equipment Status Changed: ${equipmentName}`,
    html: wrap(
      `Equipment Status Updated`,
      `<p><strong>${equipmentName}</strong> changed from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.</p>`,
      link
    ),
    plain: `${equipmentName} status: ${oldStatus} → ${newStatus}. View at ${link}`,
  };
}

export function projectCreated(title: string, priority: string, projectId: string) {
  const link = `${BASE_URL}/projects/${projectId}`;
  return {
    subject: `New Project: ${title}`,
    html: wrap(
      `Project Created`,
      `<p>A new project was created:</p><ul><li><strong>${title}</strong></li><li>Priority: ${priority}</li></ul>`,
      link
    ),
    plain: `New project "${title}" (${priority}). View at ${link}`,
  };
}

export function maintenanceLogged(equipmentName: string, description: string, equipmentId: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  return {
    subject: `Maintenance Logged: ${equipmentName}`,
    html: wrap(
      `Maintenance Activity`,
      `<p>Maintenance was logged on <strong>${equipmentName}</strong>:</p><p>${description}</p>`,
      link
    ),
    plain: `Maintenance logged on ${equipmentName}: ${description.slice(0, 100)}. View at ${link}`,
  };
}

export function workOrdersDue(orders: { title: string; equipmentName: string; dueDate: string }[]) {
  const link = `${BASE_URL}/work-orders`;
  const list = orders
    .map((o) => `<li><strong>${o.title}</strong> — ${o.equipmentName} (due ${o.dueDate})</li>`)
    .join("");
  return {
    subject: `${orders.length} Work Order${orders.length !== 1 ? "s" : ""} Due/Overdue`,
    html: wrap(
      `Work Orders Due`,
      `<p>${orders.length} work order${orders.length !== 1 ? "s are" : " is"} due or overdue:</p><ul>${list}</ul>`,
      link
    ),
    plain: `${orders.length} work orders due/overdue: ${orders.map((o) => o.title).join(", ")}. View at ${link}`,
  };
}

export function projectsDue(projects: { title: string; dueDate: string }[]) {
  const link = `${BASE_URL}/projects`;
  const list = projects
    .map((p) => `<li><strong>${p.title}</strong> (due ${p.dueDate})</li>`)
    .join("");
  return {
    subject: `${projects.length} Project${projects.length !== 1 ? "s" : ""} Due/Overdue`,
    html: wrap(
      `Projects Due`,
      `<p>${projects.length} project${projects.length !== 1 ? "s are" : " is"} due or overdue:</p><ul>${list}</ul>`,
      link
    ),
    plain: `${projects.length} projects due/overdue: ${projects.map((p) => p.title).join(", ")}. View at ${link}`,
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

interface DigestRow {
  title: string;
  type: string;
  message: string;
  link: string;
  createdAt: Date;
}

/**
 * Summary table digest emailed 3x daily (5am / 12pm / 5pm) consolidating
 * queued digest-urgency notifications for a single user.
 */
export function statusDigest(rows: DigestRow[], slotLabel: string) {
  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${r.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${r.type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px;"><a href="${r.link}" style="color: #2563eb; text-decoration: none;">${r.title}</a></td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #4b5563;">${r.message}</td>
      </tr>
    `
    )
    .join("");

  return {
    subject: `QMS ${slotLabel} Digest — ${rows.length} update${rows.length !== 1 ? "s" : ""}`,
    html: wrap(
      `${slotLabel} Digest`,
      `
        <p>${rows.length} update${rows.length !== 1 ? "s" : ""} since the last digest:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Time</th>
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Type</th>
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 8px; text-align: left; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Detail</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `
    ),
    plain: `QMS ${slotLabel} digest — ${rows.length} updates. ${rows.map((r) => r.title).join("; ")}`,
  };
}
