import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Hash a string into a 63-bit BigInt suitable for pg_advisory_xact_lock.
// Simple djb2 — collisions between unrelated lock keys would just serialize
// two unrelated transactions, which is fine.
function hashToAdvisoryKey(s: string): bigint {
  let hash = BigInt(5381);
  const FIVE = BigInt(5);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << FIVE) + hash) ^ BigInt(s.charCodeAt(i));
  }
  const mask = (BigInt(1) << BigInt(63)) - BigInt(1);
  return hash & mask;
}

// Acquire a transaction-scoped advisory lock. Held until COMMIT/ROLLBACK.
// Callers inside $transaction() should await this before counting existing
// rows, so a concurrent writer can't race them to the same sequence number.
export async function acquireAdvisoryLock(
  tx: Prisma.TransactionClient,
  lockKey: string,
): Promise<void> {
  const key = hashToAdvisoryKey(lockKey);
  // $executeRawUnsafe with a bigint literal is safe here — we never interpolate
  // user input, the key is derived from a string constant per call site.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${key.toString()})`);
}

// Helper: generate the next yearly number (N) for a record type, race-safe.
//   lockKey: e.g. "ncr-2026" — scopes the lock so different types/years
//   don't block each other.
//   countCurrent: returns the number of rows already in the sequence.
// Returns the next integer N (1-indexed).
export async function nextYearlyNumber(
  tx: Prisma.TransactionClient,
  lockKey: string,
  countCurrent: () => Promise<number>,
): Promise<number> {
  await acquireAdvisoryLock(tx, lockKey);
  const current = await countCurrent();
  return current + 1;
}

// Format an integer N as a zero-padded string (e.g. 1 → "001").
export function formatSequence(n: number, pad = 3): string {
  return String(n).padStart(pad, "0");
}

// Convenience: build a prefixed, year-scoped label like "NCR-2026-007".
export function buildYearlyLabel(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${formatSequence(n)}`;
}

// Year boundary helpers mirroring what each caller was computing inline.
export function yearBoundaries(year: number): { startOfYear: Date; endOfYear: Date } {
  return {
    startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
    endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
  };
}

// Run a block that needs a race-safe sequence number on prisma. The block
// receives (tx, nextNumber, label) — nextNumber is an int, label is the
// formatted string like "NCR-2026-007".
export async function withYearlyNumber<T>(
  prefix: string,
  opts: {
    year?: number;
    // Count function receives the tx so it can run inside the same lock.
    countCurrent: (tx: Prisma.TransactionClient, bounds: { startOfYear: Date; endOfYear: Date }) => Promise<number>;
    run: (tx: Prisma.TransactionClient, label: string) => Promise<T>;
  },
): Promise<T> {
  const year = opts.year ?? new Date().getFullYear();
  const bounds = yearBoundaries(year);
  return prisma.$transaction(async (tx) => {
    const n = await nextYearlyNumber(
      tx,
      `${prefix.toLowerCase()}-${year}`,
      () => opts.countCurrent(tx, bounds),
    );
    const label = buildYearlyLabel(prefix, year, n);
    return opts.run(tx, label);
  });
}
