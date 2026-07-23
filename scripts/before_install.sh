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
  pkill -f "node.*server.js" 2>/dev/null || true
fi

# Install Node.js if not present
if ! command -v node &>/dev/null; then
  echo "[before_install] Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install PM2 globally for better app management
if ! command -v pm2 &>/dev/null; then
  echo "[before_install] Installing PM2..."
  sudo npm install -g pm2
fi

# Create logs directory
mkdir -p "$APP_DIR/logs"
chown -R ec2-user:ec2-user "$APP_DIR" 2>/dev/null || true

echo "[before_install] BeforeInstall hook complete."
