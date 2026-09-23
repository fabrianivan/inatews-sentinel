#!/usr/bin/env bash
set -euo pipefail

# GCP VM production bootstrap for INATEWS Sentinel
# Usage:
#   sudo ./scripts/gcp-prod-install.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

APP_DIR="/home/${SUDO_USER:-ubuntu}/confluent-ai-day"
USER_NAME="${SUDO_USER:-ubuntu}"

if [ ! -d "$APP_DIR" ]; then
  echo "Repository not found at $APP_DIR"
  exit 1
fi

apt-get update
apt-get install -y nginx curl ca-certificates git

# Install Go if missing
if ! command -v go >/dev/null 2>&1; then
  curl -fsSL https://go.dev/dl/go1.23.4.linux-amd64.tar.gz -o /tmp/go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tar.gz
  export PATH="/usr/local/go/bin:$PATH"
  echo 'export PATH=/usr/local/go/bin:$PATH' >> /etc/profile
fi

# Install Node LTS if missing
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

# Install frontend dependencies
cd "$APP_DIR/dashboard"
npm install
npm run build

# Install nginx config
cat > /etc/nginx/conf.d/inatews.conf <<'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# nginx reload
nginx -t
systemctl enable nginx
systemctl restart nginx

# copy service files
cp "$APP_DIR/scripts/gcp-systemd-backend.service" /etc/systemd/system/inatews-backend.service
cp "$APP_DIR/scripts/gcp-systemd-frontend.service" /etc/systemd/system/inatews-frontend.service

# Make service files use actual user if not already set
sed -i "s/your-user/$USER_NAME/g" /etc/systemd/system/inatews-backend.service
sed -i "s/your-user/$USER_NAME/g" /etc/systemd/system/inatews-frontend.service

systemctl daemon-reload
systemctl enable inatews-backend.service
systemctl enable inatews-frontend.service

echo "===================================================="
echo "Production bootstrap complete."
echo "Next steps:"
echo "  1. Edit /etc/inatews-gcp.env"
echo "  2. Replace your-domain.com in /etc/nginx/conf.d/inatews.conf"
echo "  3. systemctl start inatews-backend.service"
echo "  4. systemctl start inatews-frontend.service"
echo "===================================================="
