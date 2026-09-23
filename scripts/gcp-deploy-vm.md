# GCP VM Deployment with OS Environment Variables

This project is already compatible with deployment on Google Cloud when secrets and config are loaded from the OS environment.

## 1) Export environment variables

Create a file with your production values:

```bash
cp scripts/gcp-env.example /etc/inatews-gcp.env
nano /etc/inatews-gcp.env
```

Then load them:

```bash
set -a
source /etc/inatews-gcp.env
set +a
```

## 2) Start backend

```bash
cd /home/your-user/inatews-sentinel
chmod +x scripts/gcp-start-backend.sh
./scripts/gcp-start-backend.sh
```

## 3) Start frontend

```bash
cd /home/your-user/inatews-sentinel
chmod +x scripts/gcp-start-frontend.sh
./scripts/gcp-start-frontend.sh
```

## 4) Example Cloud Run deployment

### Backend

```bash
gcloud run deploy inatews-backend \
  --region=asia-southeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars "SERVER_PORT=8080,CORS_ORIGIN=https://your-frontend-domain,DEMO_MODE=false,CONFLUENT_BOOTSTRAP_SERVERS=...,CONFLUENT_API_KEY=...,CONFLUENT_API_SECRET=..."
```

### Frontend

```bash
gcloud run deploy inatews-dashboard \
  --region=asia-southeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_API_URL=https://inatews-backend-url"
```

## 5) Best practice

Use Google Secret Manager for sensitive values.
