#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"
APP_NAME="boa-security-system"

echo "[stop_server] Stopping application..."

# Stop PM2 application if running
if command -v pm2 &>/dev/null; then
  echo "[stop_server] Stopping PM2 process..."
  pm2 stop "$APP_NAME" 2>/dev/null || true
  pm2 delete "$APP_NAME" 2>/dev/null || true
fi

# Kill any remaining Node processes
echo "[stop_server] Killing any remaining Node.js processes..."
pkill -f "node" 2>/dev/null || true

# Clean up PID file if it exists
if [ -f "$APP_DIR/logs/app.pid" ]; then
  rm -f "$APP_DIR/logs/app.pid"
fi

echo "[stop_server] ApplicationStop hook complete."
