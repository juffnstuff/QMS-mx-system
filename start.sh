#!/bin/sh
set -e

echo "Starting QMS Equipment Tracker..."

# Ensure the attachments directory is writable by the app user. Railway
# volume mounts come in owned by root, so the nextjs (uid 1001) user can't
# mkdir/write there without help. If we're running as root, fix permissions
# and then re-exec this script as nextjs via su-exec.
ATTACHMENTS_DIR="${ATTACHMENTS_DIR:-/data/attachments}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$ATTACHMENTS_DIR" 2>/dev/null || echo "Warning: could not create $ATTACHMENTS_DIR"
  chown -R 1001:1001 "$ATTACHMENTS_DIR" 2>/dev/null || echo "Warning: could not chown $ATTACHMENTS_DIR"
  # Drop privileges for the rest of the script.
  exec su-exec 1001:1001 sh "$0" "$@"
fi

# Run database migrations (continue even if they fail, e.g. already applied)
echo "Running database migrations..."
npx prisma migrate deploy 2>&1 || echo "Warning: migrations failed or already applied, continuing..."

# Run seed if SEED_ON_START is set (one-time use, then remove the env var)
if [ "$SEED_ON_START" = "true" ]; then
  echo "Running database seed..."
  npx tsx prisma/seed.ts 2>&1 || echo "Warning: seed failed, continuing..."
fi

# Start cron scheduler in the background
echo "Starting cron scheduler..."
node scripts/cron-scheduler.js &

echo "Starting server on port ${PORT:-3000}..."
exec node server.js
