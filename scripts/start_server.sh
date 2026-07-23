#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"
APP_NAME="boa-security-system"

echo "[start_server] Starting application..."

cd "$APP_DIR"

# Ensure logs directory exists
mkdir -p "$APP_DIR/logs"

# Use PM2 if available for better process management
if command -v pm2 &>/dev/null; then
  echo "[start_server] Starting with PM2..."
  pm2 start npm --name "$APP_NAME" -- start \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --error "$APP_DIR/logs/error.log" \
    --output "$APP_DIR/logs/app.log" || true
  
  pm2 save
  echo "[start_server] Application started with PM2."
else
  echo "[start_server] PM2 not found. Starting with Node.js directly..."
  NODE_ENV=production nohup node index.html \
    >> "$APP_DIR/logs/app.log" 2>&1 &
  
  echo $! > "$APP_DIR/logs/app.pid"
  echo "[start_server] Application started with PID $(cat "$APP_DIR/logs/app.pid")."
fi

echo "[start_server] Waiting for application to be ready..."
sleep 3

echo "[start_server] ApplicationStart hook complete."
