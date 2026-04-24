import path from "node:path";
import { promises as fs } from "node:fs";

export const RECORD_TYPES = [
  "equipment",
  "ncr",
  "work_order",
  "project",
  "capa",
  "complaint",
  "maintenance_schedule",
  "maintenance_log",
] as const;

export type AttachmentRecordType = (typeof RECORD_TYPES)[number];

export function isValidRecordType(v: string): v is AttachmentRecordType {
  return (RECORD_TYPES as readonly string[]).includes(v);
}

// Max size per file. Photos from modern phones can exceed 10 MB; 25 MB covers
// those plus reasonable PDFs/Office docs without inviting abuse.
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// Base directory for attachments on disk. Defaults to /data/attachments so it
// lines up with the Railway volume mount in start.sh.
export function getAttachmentsDir(): string {
  return process.env.ATTACHMENTS_DIR || "/data/attachments";
}

// Splitting by first 4 chars of the cuid keeps any one directory from holding
// tens of thousands of files, which slows down some filesystems.
export function buildStorageKey(id: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase().slice(0, 16);
  const safeExt = /^\.[a-z0-9]+$/i.test(ext) ? ext : "";
  return path.join(id.slice(0, 2), id.slice(2, 4), `${id}${safeExt}`);
}

export function resolveStoragePath(storageKey: string): string {
  const base = getAttachmentsDir();
  const full = path.join(base, storageKey);
  const rel = path.relative(base, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export async function ensureStorageDir(storageKey: string): Promise<void> {
  const dir = path.dirname(resolveStoragePath(storageKey));
  await fs.mkdir(dir, { recursive: true });
}

export async function writeAttachmentFile(
  storageKey: string,
  data: Buffer | Uint8Array
): Promise<void> {
  await ensureStorageDir(storageKey);
  await fs.writeFile(resolveStoragePath(storageKey), data);
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(resolveStoragePath(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_").trim();
  return base.length > 0 ? base.slice(0, 255) : "file";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
