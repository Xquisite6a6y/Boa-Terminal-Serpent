#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"
APP_NAME="boa-security-system"

echo "[stop_server] Stopping application..."

# Stop via PM2 if available
if command -v pm2 &>/dev/null; then
  echo "[stop_server] Stopping PM2 process..."
  pm2 stop "$APP_NAME" 2>/dev/null || true
  pm2 delete "$APP_NAME" 2>/dev/null || true
  echo "[stop_server] Application stopped via PM2."

# Fall back to PID file
elif [ -f "$APP_DIR/logs/app.pid" ]; then
  PID=$(cat "$APP_DIR/logs/app.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "[stop_server] Stopping process with PID $PID..."
    kill -SIGTERM "$PID" || true

    # Wait up to 10 seconds for graceful shutdown
    for i in $(seq 1 10); do
      if ! kill -0 "$PID" 2>/dev/null; then
        echo "[stop_server] Process stopped gracefully."
        break
      fi
      sleep 1
    done

    # Force kill if still running
    if kill -0 "$PID" 2>/dev/null; then
      echo "[stop_server] Force killing process $PID..."
      kill -SIGKILL "$PID" 2>/dev/null || true
    fi
  else
    echo "[stop_server] Process $PID not running. Skipping."
  fi
  rm -f "$APP_DIR/logs/app.pid"

else
  echo "[stop_server] No running process found. Skipping."
fi

echo "[stop_server] Stop hook complete."
