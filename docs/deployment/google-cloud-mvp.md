# Google Cloud MVP Deployment (Backend)

This guide deploys the CookMate backend to Google Cloud Run with automated deploys from GitHub Actions on every push to `main`, plus manual deploys through GitHub Actions when needed.

## Scope

- Backend only (`server/`)
- Public Cloud Run endpoint (MVP)
- GitHub Actions + Workload Identity Federation (no long-lived service account keys)
- Full backend flow, including WebSocket paths (`/ws/cooking-live`, `/ws/scan`)
- Manual production deploys via GitHub Actions `workflow_dispatch`

## 1) One-time GCP setup

Set project:

```bash
gcloud config set project cookmate-489807
```

Enable required APIs:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudbuild.googleapis.com
```

Create Artifact Registry repo:

```bash
gcloud artifacts repositories create cookmate-backend \
  --repository-format=docker \
  --location=us-central1 \
  --description="CookMate backend images"
```

Create deploy service account:

```bash
gcloud iam service-accounts create github-deploy-sa \
  --display-name="GitHub deploy SA"
```

Grant least-privilege roles:

```bash
PROJECT_ID="cookmate-489807"
SA="github-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountUser"
```

## 2) Workload Identity Federation for GitHub Actions

Create pool/provider:

```bash
PROJECT_ID="cookmate-489807"
PROJECT_NUMBER="$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')"

gcloud iam workload-identity-pools create github-pool \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Pool"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='natecl/CookMate' && assertion.ref=='refs/heads/main'"
```

Allow only this repo + main branch to impersonate deploy SA:

```bash
PROJECT_ID="cookmate-489807"
PROJECT_NUMBER="$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')"
SA="github-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/natecl/CookMate"
```

Provider resource (for GitHub var):

```bash
projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

## 3) GitHub repository configuration

Set repository variables:

- `GCP_PROJECT_ID`: `cookmate-489807`
- `GCP_REGION`: `us-central1`
- `GAR_REPO`: `cookmate-backend`
- `CLOUD_RUN_SERVICE`: `cookmate-backend`
- `WIF_PROVIDER`: `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `DEPLOY_SERVICE_ACCOUNT`: `github-deploy-sa@cookmate-489807.iam.gserviceaccount.com`
- `CLIENT_URL`: your frontend origin, e.g. `https://<frontend-domain>`

Set repository secret:

- `GEMINI_API_KEY`

## 4) Deploy flow

Deployment is automated on push to `main` using:

- Workflow: `.github/workflows/deploy-backend.yml`
- Build context: repository root (`.`) using `server/Dockerfile` so shared root `types/` are included
- Target: Cloud Run service in `us-central1`
- Runtime env:
  - `NODE_ENV=production`
  - `CLIENT_URL=<GitHub variable>`
  - `GEMINI_API_KEY=<GitHub secret>`

Cloud Run timeout is set to `3600` seconds for long-lived live cooking sessions.

Manual production deploys are also available from the GitHub Actions UI through `workflow_dispatch`. This is useful when you need to redeploy the current `main` commit without creating a new commit.

## 5) Post-deploy verification

Get URL:

```bash
gcloud run services describe cookmate-backend \
  --region us-central1 \
  --format='value(status.url)'
```

Verify health endpoint:

```bash
curl "<CLOUD_RUN_URL>/api/health"
```

Expected:

```json
{ "status": "success", "message": "frontend and backend connected" }
```

If you launched the deploy manually, verify the GitHub Actions run page shows the expected commit SHA before checking Cloud Run.

## 6) Rollback checklist

Use this when production needs to return to an older backend commit.

1. Identify the last known good commit on `main`
2. Decide rollback method:
   - Use `workflow_dispatch` if the good commit is already the current `main` HEAD and you only need to redeploy it
   - Revert or force-push `main` to the older commit if production must run older code than the current branch tip
3. Confirm the GitHub Actions run is deploying the expected commit SHA
4. Wait for the Cloud Run revision to finish deploying
5. Verify `GET /api/health` on the Cloud Run service URL
6. Smoke-test one API flow and one WebSocket flow
7. Confirm Cloud Run logs no longer show the original failure mode
8. Record which commit was rolled back and why

## 7) Proof package for requirement

### A) Screen recording proof (required)

Record 30-90 seconds showing:

1. GCP Console -> Cloud Run -> `cookmate-backend` service page
2. Latest revision and timestamp changing after a push to `main`
3. Cloud Run logs showing requests to `/api/health` (and optionally `/ws/cooking-live`)

### B) Repo/code proof (required)

Include links/screenshots to:

- `.github/workflows/deploy-backend.yml`
- `server/Dockerfile`
- `scripts/gcp/deploy-cloud-run.sh`
- `server/services/agent/nanabotService.ts` and `server/services/vision/*` showing Google AI service usage

## 8) Security notes

- Workload Identity Federation is used instead of service account JSON keys.
- CORS is explicit via `CLIENT_URL` allowlist.
- No secrets are committed to repo.
- Public access is enabled only for MVP; move to authenticated access after demo requirements are met.
