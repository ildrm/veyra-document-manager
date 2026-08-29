# Get Veyra running locally

This tutorial is for developers running the first vertical slice on a workstation.

## Prerequisites

- Node.js 24 and Corepack
- pnpm 11
- Python 3.12 or newer
- Docker Engine with Compose v2
- At least 8 GB of free memory for the full infrastructure profile

## 1. Configure local values

```bash
cp .env.example .env
cp infrastructure/.env.example infrastructure/.env
```

All checked-in values are local-development defaults. Do not promote them to another environment. Keep real credentials in an approved secret manager and out of Git.

## 2. Start dependencies

Start the core dependencies:

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml up -d
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml ps
```

For workflow or telemetry work, start the optional profiles too:

```bash
docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml \
  --profile workflow --profile observability up -d
```

Wait until the long-running services report healthy. `minio-init` and `openfga-migrate` should exit with status 0.

## 3. Install and initialize the TypeScript workspace

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm db:seed
```

Run the web and API workspaces:

```bash
pnpm dev
```

The web application uses `http://localhost:3000`; the API uses `http://localhost:4000`.

## 4. Run the AI service

In a second terminal:

```bash
python3.12 -m venv services/ai/.venv
source services/ai/.venv/bin/activate
python -m pip install -e 'services/ai[dev]'
cd services/ai
AI_INTERNAL_API_TOKEN=development-only-change-me \
  uvicorn knowledge_ai_service.app:app --host 0.0.0.0 --port 8000 --reload
```

The service is available at `http://localhost:8000`; liveness and readiness are exposed at `/health/live` and `/health/ready`. The API must use the same development-only internal token. The default `evidence-only` provider does not call an external model.

## 5. Optional identity and authorization setup

The application defaults to explicit development adapters. To exercise OIDC, open the Keycloak administration console at `http://localhost:8080`, sign in with the development admin values from `infrastructure/.env`, and create a user in the imported `veyra` realm.

To exercise OpenFGA, publish and test the model as described in [`infrastructure/openfga/README.md`](../infrastructure/openfga/README.md), then set `OPENFGA_STORE_ID`, `OPENFGA_MODEL_ID`, and the non-development authorization adapter in `.env`.

## Verify the workspace

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cd services/ai
ruff check .
mypy src
pytest
```

See [`infrastructure/README.md`](../infrastructure/README.md) for ports and troubleshooting. Stop containers with `docker compose --env-file infrastructure/.env -f infrastructure/compose.yaml down`; named volumes are retained.
