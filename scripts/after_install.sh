#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"

# Load nvm and ensure node/npm are on PATH
export NVM_DIR="/opt/nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# Fallback: add known node bin paths
export PATH="/opt/nvm/versions/node/$(ls /opt/nvm/versions/node/ 2>/dev/null | head -1)/bin:/usr/local/bin:$PATH"

echo "[after_install] Starting AfterInstall hook..."

cd "$APP_DIR"

# Install production dependencies
echo "[after_install] Installing dependencies with npm ci..."
npm ci --omit=dev

# Run build if a build script exists
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo "[after_install] Running build..."
  npm run build
else
  echo "[after_install] No build script found, skipping."
fi

# Set correct permissions
chmod -R 755 "$APP_DIR/scripts" 2>/dev/null || true
chown -R ec2-user:ec2-user "$APP_DIR" 2>/dev/null || true

echo "[after_install] AfterInstall hook complete."
