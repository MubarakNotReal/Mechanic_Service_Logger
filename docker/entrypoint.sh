#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  npm run db:push
fi

echo "Starting AutoService Manager..."
exec node dist/index.js
