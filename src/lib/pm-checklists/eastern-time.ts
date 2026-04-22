// Eastern-time (America/New_York) day boundary utilities.
//
// Railway servers run in UTC, but PM scheduling — "today's checklist", "next
// due date" — needs to respect the factory's local day. These helpers return
// JS Date instances (which are always absolute UTC under the hood) that
// represent the exact moment of midnight or 23:59:59.999 in Eastern time,
// correctly handling DST.

export const EASTERN_TZ = "America/New_York";

// YMD string ("2026-04-21") of the Eastern date containing `d`.
export function easternYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Moment of 00:00:00 Eastern on the day containing `d`.
export function startOfEasternDay(d: Date): Date {
  const [y, m, day] = easternYmd(d).split("-").map(Number);

  // Offset of Eastern relative to UTC at noon on this date (safe across DST —
  // the noon Eastern hour is either 12 when UTC offset matches or shifted).
  const utcNoonCandidate = new Date(Date.UTC(y, m - 1, day, 12, 0, 0, 0));
  const easternHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TZ,
      hour: "numeric",
      hour12: false,
    }).format(utcNoonCandidate),
  );
  const offsetHours = 12 - easternHour;
  return new Date(Date.UTC(y, m - 1, day, offsetHours, 0, 0, 0));
}

// Moment of 23:59:59.999 Eastern on the day containing `d`.
export function endOfEasternDay(d: Date): Date {
  return new Date(startOfEasternDay(d).getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Advance the schedule's nextDue to the end of the next period in Eastern time.
// Handles DST transitions (the "+1 day" is actually end of the *next* Eastern
// calendar day, not exactly 86_400_000 ms later).
export function advanceEasternNextDue(frequency: string, from: Date): Date {
  const [y, m, day] = easternYmd(from).split("-").map(Number);
  let targetY = y;
  let targetM = m;
  let targetD = day;
  switch (frequency) {
    case "daily":
      targetD += 1;
      break;
    case "weekly":
      targetD += 7;
      break;
    case "monthly":
      targetM += 1;
      break;
    case "quarterly":
      targetM += 3;
      break;
    default:
      targetD += 1;
  }
  // Construct a date in Eastern for the target YMD, then take endOfEasternDay.
  // Using UTC noon as a stable anchor avoids DST edge cases around midnight.
  const anchor = new Date(Date.UTC(targetY, targetM - 1, targetD, 12, 0, 0, 0));
  return endOfEasternDay(anchor);
}
