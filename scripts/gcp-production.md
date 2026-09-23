# GCP production deployment for INATEWS Sentinel

## 1) Prepare VM

```bash
sudo ./scripts/gcp-prod-install.sh
```

## 2) Edit environment file

```bash
sudo nano /etc/inatews-gcp.env
```

Example:

```bash
SERVER_PORT=8080
CORS_ORIGIN=https://your-frontend-domain
DEMO_MODE=false

CONFLUENT_BOOTSTRAP_SERVERS=pkc-xxxxx.region.provider.confluent.cloud:9092
CONFLUENT_API_KEY=your-key
CONFLUENT_API_SECRET=your-secret
NEXT_PUBLIC_API_URL=https://your-backend-domain
```

## 3) Configure domain and nginx

```bash
sudo nano /etc/nginx/conf.d/inatews.conf
```

Replace `your-domain.com` with your real domain.

Then validate nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 4) Start services

```bash
sudo systemctl start inatews-backend.service
sudo systemctl start inatews-frontend.service
```

## 5) Check app status

```bash
sudo systemctl status inatews-backend.service
sudo systemctl status inatews-frontend.service
sudo journalctl -u inatews-backend.service -f
sudo journalctl -u inatews-frontend.service -f
```

## 6) Optional: HTTPS with Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 7) Best practice

Use Google Secret Manager for all sensitive values instead of plain environment files when possible.
