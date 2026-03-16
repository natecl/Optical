# Vercel Frontend Deployment

This guide deploys the CookMate frontend to Vercel with GitHub Actions on every push to `main` that changes frontend code.

## Scope

- Frontend only (`client/`)
- Production deploys on push to `main`
- Shared type updates (`types/`) also trigger a frontend deploy
- Manual deploys are available through GitHub Actions `workflow_dispatch`

## 1) One-time Vercel project setup

Create a Vercel project connected to this repository and set:

- Framework preset: `Vite`
- Root directory: `client`
- Production branch: `main`

Set the Vercel production environment variables:

- `VITE_API_BASE_URL`: your production backend URL, for example `https://<cloud-run-service>.run.app`
- `VITE_WS_BASE_URL`: your production backend WebSocket base URL, for example `wss://<cloud-run-service>.run.app`

These values are pulled into GitHub Actions during `vercel pull`, so the workflow does not store them in GitHub.

## 2) GitHub repository configuration

Set repository variables:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Set repository secret:

- `VERCEL_TOKEN`

The token should belong to a Vercel account or team member that can deploy the linked frontend project.

## 3) Deploy flow

Deployment is automated on push to `main` using:

- Workflow: `.github/workflows/deploy-frontend.yml`
- Trigger paths:
  - `client/**`
  - `types/**`
  - `.github/workflows/deploy-frontend.yml`

The workflow:

1. Checks out the repo
2. Installs client dependencies
3. Pulls Vercel production settings into the workflow runner
4. Triggers a production deploy with `vercel deploy --prod`

The frontend also includes `client/vercel.json`, which rewrites deep links like `/cooking` back to the SPA entrypoint so browser refreshes do not 404 on React Router routes.

Because the deploy is tied to the pushed commit on `main`, reverting or force-pushing `main` to an older commit will redeploy that older frontend version on the next successful workflow run.

## 4) Post-deploy verification

After a push to `main`:

1. Open GitHub Actions and confirm `Deploy Frontend To Vercel` passed
2. Open the Vercel project and confirm the latest production deployment matches the commit you pushed
3. Open the production site and verify it is calling the expected backend URL

## 5) Notes

- Backend and frontend deploy independently. A push that changes only `server/**` will not redeploy the frontend.
- If the backend production URL changes, update the Vercel project env vars before the next frontend deploy.
