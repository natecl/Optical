#!/usr/bin/env bash
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${GAR_REPO:?Set GAR_REPO}"
: "${CLOUD_RUN_SERVICE:?Set CLOUD_RUN_SERVICE}"
: "${CLIENT_URL:?Set CLIENT_URL}"
: "${GEMINI_API_KEY:?Set GEMINI_API_KEY}"

IMAGE_URI="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GAR_REPO}/cookmate-backend:$(date +%Y%m%d-%H%M%S)"

gcloud config set project "$GCP_PROJECT_ID"
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

docker build -t "$IMAGE_URI" ./server
docker push "$IMAGE_URI"

gcloud run deploy "$CLOUD_RUN_SERVICE" \
  --image "$IMAGE_URI" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 3600 \
  --set-env-vars "NODE_ENV=production,PORT=8080,CLIENT_URL=${CLIENT_URL},GEMINI_API_KEY=${GEMINI_API_KEY}"

gcloud run services describe "$CLOUD_RUN_SERVICE" \
  --region "$GCP_REGION" \
  --format='value(status.url)'
