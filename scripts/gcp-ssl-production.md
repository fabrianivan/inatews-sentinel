# GCP production with HTTPS and Nginx

## 1) Configure your VM environment

```bash
sudo nano /etc/inatews-gcp.env
```

Add the required values.

## 2) Configure and start backend + frontend services

```bash
sudo systemctl daemon-reload
sudo systemctl enable inatews-backend.service
sudo systemctl enable inatews-frontend.service
sudo systemctl start inatews-backend.service
sudo systemctl start inatews-frontend.service
```

## 3) Enable SSL with Certbot

```bash
sudo ./scripts/gcp-ssl-setup.sh your-domain.com
```

## 4) Validate Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Check site

Open:

```bash
https://your-domain.com
```

## 6) Optional: test certificates

```bash
sudo certbot renew --dry-run
```
