/**
 * In-app cron scheduler — runs inside the Next.js server process.
 * Starts automatically when the app boots via start.sh.
 *
 * Schedule:
 * - Every 6 hours: check maintenance, work orders, projects
 * - Every 6 hours (offset 5 min): M365 email/Teams scan
 */

const cron = require("node-cron");

const APP_URL = `http://localhost:${process.env.PORT || 3000}`;
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.log("[Cron] CRON_SECRET not set — skipping cron scheduler");
  process.exit(0);
}

async function callEndpoint(name, path, authStyle) {
  const headers =
    authStyle === "bearer"
      ? { authorization: `Bearer ${CRON_SECRET}` }
      : { "x-cron-secret": CRON_SECRET };

  try {
    const res = await fetch(`${APP_URL}${path}`, { headers });
    const data = await res.json();
    console.log(`[Cron] ${name}: ${res.status} —`, JSON.stringify(data));
  } catch (err) {
    console.error(`[Cron] ${name}: failed —`, err.message);
  }
}

async function runAllChecks() {
  console.log(`[Cron] Running scheduled checks at ${new Date().toISOString()}`);
  await callEndpoint("Maintenance", "/api/cron/check-maintenance", "bearer");
  await callEndpoint("Work Orders", "/api/cron/check-work-orders", "bearer");
  await callEndpoint("Projects", "/api/cron/check-projects", "bearer");
}

async function runM365Scan() {
  console.log(`[Cron] Running M365 scan at ${new Date().toISOString()}`);
  await callEndpoint("M365 Poll", "/api/cron/m365-poll", "header");
}

async function runCleanup() {
  console.log(`[Cron] Running message cleanup at ${new Date().toISOString()}`);
  await callEndpoint("Cleanup Messages", "/api/cron/cleanup-messages", "header");
}

async function runGenerateChecklists() {
  console.log(`[Cron] Generating PM checklist completions at ${new Date().toISOString()}`);
  await callEndpoint("Generate Checklists", "/api/cron/generate-checklists", "bearer");
}

// Schedule: "0 */6 * * *" = every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
cron.schedule("0 */6 * * *", () => {
  runAllChecks();
});

// M365 scan offset by 5 minutes to avoid overlap
cron.schedule("5 */6 * * *", () => {
  runM365Scan();
});

// Daily message retention cleanup at 03:10 UTC (off-peak)
cron.schedule("10 3 * * *", () => {
  runCleanup();
});

// Daily PM checklist generation at 00:00 Eastern (midnight, before first shift)
cron.schedule(
  "0 0 * * *",
  () => {
    runGenerateChecklists();
  },
  { timezone: "America/New_York" },
);

console.log("[Cron] Scheduler started — checks every 6 hours, cleanup + PM generation daily (midnight Eastern)");

// Also run once 60 seconds after startup (gives server time to be ready).
// runGenerateChecklists is idempotent — safe to re-run; ensures a deploy at
// any time picks up today's checklists without waiting for midnight.
setTimeout(() => {
  console.log("[Cron] Running initial checks after startup...");
  runAllChecks();
  runGenerateChecklists();
}, 60000);
