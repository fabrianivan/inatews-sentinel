#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

DOMAIN="${1:-your-domain.com}"
if [ "$DOMAIN" = "your-domain.com" ]; then
  echo "Usage: sudo ./scripts/gcp-ssl-setup.sh your-domain.com"
  echo "Example: sudo ./scripts/gcp-ssl-setup.sh app.example.com"
  exit 1
fi

apt-get update
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN

cp /Users/fabrianivan/confluent-ai-day/scripts/gcp-ssl-nginx.conf /etc/nginx/conf.d/inatews-ssl.conf
sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/conf.d/inatews-ssl.conf

nginx -t
systemctl reload nginx

echo "SSL setup complete for $DOMAIN"
