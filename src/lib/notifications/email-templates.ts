const BASE_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(title: string, body: string, link?: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1f2937; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 16px;">QMS Tracker &mdash; RubberForm</h2>
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

// ---------------------------------------------------------------------------
// IMMEDIATE ALERTS
// ---------------------------------------------------------------------------

export function equipmentDown(equipmentName: string, equipmentId: string, context?: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  const contextLine = context ? `<p>${context}</p>` : "";
  return {
    subject: `ALERT: ${equipmentName} is DOWN`,
    html: wrap(
      `Equipment Down: ${equipmentName}`,
      `<p style="color: #dc2626; font-weight: bold;">⚠ ${equipmentName} has been marked as DOWN and may need immediate attention.</p>${contextLine}`,
      link
    ),
    plain: `ALERT: ${equipmentName} is DOWN. View at ${link}`,
  };
}

// ---------------------------------------------------------------------------
// INDIVIDUAL TEMPLATES (used in digest grouping and as fallback)
// ---------------------------------------------------------------------------

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

export function workOrderCreated(title: string, priority: string, workOrderId: string) {
  const link = `${BASE_URL}/work-orders/${workOrderId}`;
  return {
    subject: `New Work Order: ${title}`,
    html: wrap(
      `New Work Order Created`,
      `<p>A new <strong>${priority}</strong> priority work order has been created: <strong>${title}</strong></p>`,
      link
    ),
    plain: `New work order: ${title} (${priority}). View at ${link}`,
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

export function projectCreated(title: string, projectId: string) {
  const link = `${BASE_URL}/projects/${projectId}`;
  return {
    subject: `New Project: ${title}`,
    html: wrap(
      `New Project Created`,
      `<p>A new project has been created: <strong>${title}</strong></p>`,
      link
    ),
    plain: `New project: ${title}. View at ${link}`,
  };
}

export function equipmentStatusChanged(equipmentName: string, newStatus: string, equipmentId: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  return {
    subject: `Equipment Update: ${equipmentName} — ${newStatus}`,
    html: wrap(
      `Equipment Status Updated`,
      `<p><strong>${equipmentName}</strong> status changed to <strong>${newStatus}</strong>.</p>`,
      link
    ),
    plain: `Equipment "${equipmentName}" is now ${newStatus}. View at ${link}`,
  };
}

export function maintenanceLogged(equipmentName: string, description: string, equipmentId: string) {
  const link = `${BASE_URL}/equipment/${equipmentId}`;
  return {
    subject: `Maintenance Logged: ${equipmentName}`,
    html: wrap(
      `Maintenance Activity Logged`,
      `<p>Maintenance was logged for <strong>${equipmentName}</strong>:</p><p>${description.slice(0, 200)}</p>`,
      link
    ),
    plain: `Maintenance logged for ${equipmentName}. View at ${link}`,
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
    .map((s) => `<li><strong>${s.title}</strong> &mdash; ${s.equipmentName}</li>`)
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

// ---------------------------------------------------------------------------
// DIGEST SUMMARY (sent at 5am, 12pm, 5pm)
// ---------------------------------------------------------------------------

interface DigestItem {
  type: string;
  title: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
}

export function statusDigest(items: DigestItem[], recipientName: string) {
  if (items.length === 0) {
    return null;
  }

  const rows = items
    .map((item) => {
      const link = getItemLink(item.relatedType, item.relatedId);
      const linkHtml = link
        ? ` <a href="${link}" style="color: #2563eb; text-decoration: none;">[View]</a>`
        : "";
      return `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #6b7280;">${formatType(item.type)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px;"><strong>${item.title}</strong>${linkHtml}</td>
      </tr>`;
    })
    .join("");

  const body = `
    <p>Hi ${recipientName},</p>
    <p>Here's your QMS status summary with <strong>${items.length}</strong> update${items.length !== 1 ? "s" : ""} since your last digest:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Type</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Details</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const dashLink = `${BASE_URL}`;
  const plain = items.map((i) => `- [${formatType(i.type)}] ${i.title}`).join("\n");

  return {
    subject: `QMS Status Summary — ${items.length} update${items.length !== 1 ? "s" : ""}`,
    html: wrap("QMS Status Summary", body, dashLink),
    plain: `QMS Status Summary (${items.length} updates):\n${plain}\nView at ${dashLink}`,
  };
}

function getItemLink(relatedType?: string | null, relatedId?: string | null): string | null {
  if (!relatedType || !relatedId) return null;
  switch (relatedType) {
    case "WorkOrder": return `${BASE_URL}/work-orders/${relatedId}`;
    case "Equipment": return `${BASE_URL}/equipment/${relatedId}`;
    case "Project": return `${BASE_URL}/projects/${relatedId}`;
    case "MaintenanceSchedule": return `${BASE_URL}/schedules`;
    case "MaintenanceLog": return `${BASE_URL}/maintenance`;
    default: return null;
  }
}

function formatType(type: string): string {
  switch (type) {
    case "work_order_assigned": return "WO Assigned";
    case "work_order_created": return "New Work Order";
    case "status_changed": return "Status Change";
    case "equipment_down": return "Equipment Down";
    case "equipment_status": return "Equipment Update";
    case "project_created": return "New Project";
    case "maintenance_logged": return "Maintenance Log";
    case "maintenance_due": return "Maintenance Due";
    default: return type.replace(/_/g, " ");
  }
}
