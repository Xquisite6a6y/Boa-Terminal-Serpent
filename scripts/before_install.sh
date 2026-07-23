#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/boa-security-system"

echo "[before_install] Starting BeforeInstall hook..."

# Create app directory if it doesn't exist
mkdir -p "$APP_DIR"

# Stop the application if it's running
echo "[before_install] Stopping any running instances..."
if command -v pm2 &>/dev/null; then
  pm2 stop boa-security-system 2>/dev/null || true
  pm2 delete boa-security-system 2>/dev/null || true
else
  pkill -f "node" 2>/dev/null || true
fi

# Remove any existing Node.js and nodesource repos
yum remove -y nodejs npm 2>/dev/null || true
rm -f /etc/yum.repos.d/nodesource*.repo
yum clean all

# Install Node.js 16 via nvm (works on any Linux, uses pre-built binaries)
echo "[before_install] Installing Node.js 16 via nvm..."
export NVM_DIR="/opt/nvm"
mkdir -p "$NVM_DIR"
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | NVM_DIR="$NVM_DIR" bash
export NVM_DIR="/opt/nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 16
nvm use 16
nvm alias default 16

# Symlink node/npm to /usr/local/bin so they're available system-wide
ln -sf "$NVM_DIR/versions/node/$(nvm version)/bin/node" /usr/local/bin/node
ln -sf "$NVM_DIR/versions/node/$(nvm version)/bin/npm" /usr/local/bin/npm
ln -sf "$NVM_DIR/versions/node/$(nvm version)/bin/npx" /usr/local/bin/npx

echo "[before_install] Node.js version: $(node -v)"
echo "[before_install] npm version: $(npm -v)"

# Install PM2 globally for better app management
if ! command -v pm2 &>/dev/null; then
  echo "[before_install] Installing PM2..."
  npm install -g pm2
fi

# Create logs directory and set ownership
mkdir -p "$APP_DIR/logs"
chown -R ec2-user:ec2-user "$APP_DIR" 2>/dev/null || true

echo "[before_install] BeforeInstall hook complete."
