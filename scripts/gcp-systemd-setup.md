# GCP VM systemd setup

## 1) Copy service files

```bash
sudo cp scripts/gcp-systemd-backend.service /etc/systemd/system/inatews-backend.service
sudo cp scripts/gcp-systemd-frontend.service /etc/systemd/system/inatews-frontend.service
```

## 2) Update user and domain values

Replace:
- `your-user` with your actual Linux user
- `https://your-backend-domain` with your backend URL
- `https://your-frontend-domain` with your frontend URL

## 3) Reload systemd

```bash
sudo systemctl daemon-reload
```

## 4) Enable services

```bash
sudo systemctl enable inatews-backend.service
sudo systemctl enable inatews-frontend.service
```

## 5) Start services

```bash
sudo systemctl start inatews-backend.service
sudo systemctl start inatews-frontend.service
```

## 6) Check status

```bash
sudo systemctl status inatews-backend.service
sudo systemctl status inatews-frontend.service
```

## 7) Logs

```bash
sudo journalctl -u inatews-backend.service -f
sudo journalctl -u inatews-frontend.service -f
```
