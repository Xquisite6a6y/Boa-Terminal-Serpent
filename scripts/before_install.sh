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

# Remove any existing Node.js and nodesource repo (Node 18 is incompatible with AL2 glibc 2.26)
yum remove -y nodejs 2>/dev/null || true
rm -f /etc/yum.repos.d/nodesource*.repo
yum clean all
yum makecache

# Install Node.js 16 (last version compatible with Amazon Linux 2 / glibc 2.26)
echo "[before_install] Installing Node.js 16..."
curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs

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
