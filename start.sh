#!/bin/sh
set -e

echo "Starting QMS Equipment Tracker..."

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
