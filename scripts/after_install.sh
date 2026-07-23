#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"

echo "[after_install] Starting AfterInstall hook..."

cd "$APP_DIR"

echo "[after_install] Installing dependencies..."
npm ci --production

echo "[after_install] Building application..."
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  npm run build
else
  echo "[after_install] No build script found, skipping build step."
fi

# Set correct permissions on app files
chmod -R 755 "$APP_DIR/scripts" 2>/dev/null || true
chown -R ec2-user:ec2-user "$APP_DIR" 2>/dev/null || true

echo "[after_install] Dependencies installed successfully."
echo "[after_install] AfterInstall hook complete."
