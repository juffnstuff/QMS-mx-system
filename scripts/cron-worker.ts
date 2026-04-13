/**
 * Railway Cron Worker
 *
 * Runs all scheduled checks directly against the database:
 * - Overdue maintenance schedules
 * - Overdue work orders
 * - Overdue projects
 * - M365 email/Teams scanning (if connections exist)
 *
 * Deploy as a separate Railway cron service from the same repo.
 * Set start command: npm run cron
 * Set cron schedule in Railway dashboard (e.g., every 6 hours: 0 */6 * * *)
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("CRON_SECRET env var is required");
  process.exit(1);
}

async function callEndpoint(path: string, authStyle: "bearer" | "header") {
  const url = `${APP_URL}${path}`;
  const headers: Record<string, string> =
    authStyle === "bearer"
      ? { authorization: `Bearer ${CRON_SECRET}` }
      : { "x-cron-secret": CRON_SECRET! };

  console.log(`→ ${path}`);
  try {
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log(`  ✓ ${res.status}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`  ✗ Failed:`, err);
    return null;
  }
}

async function main() {
  console.log(`\n=== QMS Cron Worker ===`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`App:  ${APP_URL}\n`);

  // Run all checks
  await callEndpoint("/api/cron/check-maintenance", "bearer");
  await callEndpoint("/api/cron/check-work-orders", "bearer");
  await callEndpoint("/api/cron/check-projects", "bearer");
  await callEndpoint("/api/cron/m365-poll", "header");

  console.log("\n=== Done ===\n");
}

main().catch((err) => {
  console.error("Cron worker failed:", err);
  process.exit(1);
});
