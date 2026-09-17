# SuccessfulSuccess — Meetings

[![Style](https://github.com/dobosevych/SuccessfulSuccess/actions/workflows/style.yml/badge.svg)](https://github.com/dobosevych/SuccessfulSuccess/actions/workflows/style.yml)

A small web app for today's meetings: see what is on today (name, description,
participants) and add a new one from the UI. Built to `SPEC.md`.

- **Frontend** — Next.js (App Router) + shadcn/ui, styled after Canva's visual language
- **Backend** — FastAPI + SQLAlchemy 2 (async) + Alembic
- **Database** — PostgreSQL 17

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Then open:

| What | URL |
|------|-----|
| App | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

The backend applies migrations on start and seeds a few demo meetings for today
when the database is empty (`SEED_DEMO_DATA=true`).

> **Ports already in use?** Every host port is configurable in `.env`
> (`FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`). If you change the frontend
> or backend port, update `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL` to match —
> the browser talks to the published host port, not the compose service name.

## Common tasks

```bash
make up          # start the stack
make down        # stop it
make down-v      # stop it and drop the database volume
make test        # backend test suite (creates meetings_test automatically)
make lint        # ruff + eslint
make migrate     # alembic upgrade head
make psql        # psql shell against the app database
make help        # everything else
```

## Deploy to AWS

`infra/` holds three CloudFormation templates — `ecr.yml` (image registry),
`backend.yml` (API) and `frontend.yml` (site) — plus `certificate.sh`, which
handles ACM. `make` reads `.env`, so the `aws-*` targets pick up the credentials
and settings from there; `.env` is gitignored, so real keys never reach the
repository. The AWS CLI runs in the `amazon/aws-cli` container, so nothing has to
be installed on the host (`AWS=aws make aws-deploy-backend` uses a local CLI
instead, which is noticeably faster).

```
                    ┌── /*      → S3 bucket (Next.js static export)
browser → CloudFront┤
                    └── /api/*  → ALB :80 → Fargate task :8000 → RDS :5432
```

Both stacks stand on their own — the API is reachable at its load balancer
directly — but routing the site and the API through one CloudFront distribution
means the browser sees a single origin: no CORS, and no HTTPS page blocked for
calling a plain-HTTP API.

### Backend — ALB, Fargate, RDS

Everything lands in the account's **default VPC**, in public subnets. Tasks get a
public IP so they can pull from ECR, which avoids a NAT gateway (~$32/month).
Only the ALB is reachable from the internet: the task's security group accepts
traffic from the ALB alone, and the database's accepts it from the task alone.

Fill these in `.env` first, then deploy:

```bash
AWS_ACCESS_KEY_ID=...        # an IAM user, not root access keys
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_RESOURCE_PREFIX=successfulsuccess   # prefixes every resource name
AWS_DB_PASSWORD=...          # 8-41 chars, [A-Za-z0-9_-] only
AWS_CORS_ORIGINS=*           # the frontend's origin once it has one
AWS_DOMAIN=                  # optional: api.example.com, for HTTPS
```

```bash
make aws-whoami           # check the credentials work
make aws-deploy-backend   # ECR + build & push + create/update the stack, prints the URL
make aws-deploy-frontend  # S3 + CloudFront in front of it (see below)
```

The first `make aws-deploy-backend` takes ~15 minutes; RDS is the slow part. It is
idempotent — run it again to ship a new version. Then:

| Command | What it does |
|---------|--------------|
| `make aws-url` | Print the API URL (`/docs` for Swagger, `/health` for the check) |
| `make aws-status` | Stack outputs plus desired/running task counts |
| `make aws-logs` | Follow the task logs from CloudWatch |
| `make aws-redeploy` | Push a new image and restart the tasks on it |
| `make aws-stop` / `aws-start` | Scale the service to 0 / 1 task |
| `make aws-destroy` | Delete every stack (asks first — the database goes too) |

### HTTPS on a custom domain

Set `AWS_DOMAIN` in `.env` (e.g. `api.example.com`), then:

```bash
make aws-cert             # request the ACM certificate and see it validated
make aws-deploy-backend   # add the HTTPS listener and serve the domain
```

`make aws-cert` reuses an already-issued certificate for the domain, resumes a
pending request rather than piling up new ones, and validates over DNS. If
Route 53 serves the domain **in this account**, it writes the validation record
itself and the deploy also creates the alias record pointing at the ALB.
Otherwise it prints the CNAME to add at your DNS provider and waits — interrupt
it and re-run `make aws-cert` whenever you like, the request survives. With the
DNS elsewhere, point the domain at the ALB yourself once the stack is up:

```bash
make aws-status   # LoadBalancerDomain is the CNAME target
```

The certificate must live in the same region as the ALB, which `AWS_REGION`
already takes care of. Once it is attached, port 80 stops serving the API and
returns a 301 to HTTPS, the listener runs `ELBSecurityPolicy-TLS13-1-2-2021-06`,
and `make aws-url` prints the `https://` URL. Add the domain to
`AWS_CORS_ORIGINS` if the frontend calls it from a browser.

Both stay optional: with `AWS_DOMAIN` empty the stack serves HTTP on the ALB's
own name, exactly as before. Clearing `AWS_DOMAIN` after a deploy leaves the
existing listener in place — `make aws-deploy-backend CertificateArn= DomainName=`
is not a thing, so detach it by redeploying through CloudFormation with the
parameters emptied, or delete the 443 listener in the console.

Migrations run on container start (`RUN_MIGRATIONS_ON_START=true`), so a deploy
applies them automatically.

### Frontend — S3 and CloudFront

The backend has to exist first: the distribution needs its load balancer as an
origin.

```bash
make aws-deploy-frontend   # create/update the stack, build, upload, invalidate
make aws-frontend-url      # print the site URL
```

One command does the lot: it deploys the stack, builds the Next.js **static
export** in Docker with `NEXT_PUBLIC_API_BASE_URL` pointed at the site's own URL,
uploads it to a private S3 bucket, and invalidates the CloudFront cache. Only
CloudFront can read the bucket (origin access control); nothing in S3 is public.

Two details worth knowing:

- `next build` writes `/meetings/new.html`, but the browser asks for
  `/meetings/new`. A CloudFront Function rewrites the path at the edge, so
  clean URLs work without a server.
- Static assets are uploaded with a one-year immutable cache header and the HTML
  with `no-cache`, so a deploy is visible immediately while `/_next/*` stays
  cached. The build is a separate stage in `frontend/Dockerfile`; `output` stays
  `standalone` for the compose/production image and switches to `export` only
  when `NEXT_OUTPUT=export` is set, which is the deploy target's job.

For a custom domain, set `AWS_FRONTEND_DOMAIN` in `.env` and run
`make aws-frontend-cert` before deploying. CloudFront only accepts certificates
from **us-east-1**, so that target requests it there regardless of `AWS_REGION`.
Point the domain at the `DistributionDomain` from `make aws-status`.

If the backend has its own certificate, CloudFront switches its API origin to
`https://$AWS_DOMAIN` automatically — with a certificate attached, the ALB's port
80 redirects, so an HTTP origin would bounce the browser off to the ALB's name.

### Cost

The ALB (750 h/month), RDS `db.t3.micro` (750 h + 20 GB) and ECR (500 MB) fit in
the 12-month free tier. **Fargate has no free tier**: the smallest task
(0.25 vCPU / 0.5 GB) runs about **$10/month** in `eu-central-1` if it stays up
around the clock. Two ways to cut that:

- `make aws-stop` between demos — it scales the service to zero tasks, and the
  ALB and database keep the URL and the data. `make aws-start` brings it back.
- `AWS_TASK_ARCH=ARM64 make aws-deploy-backend` — Graviton is ~20% cheaper and builds
  natively on Apple Silicon. The image platform follows this variable, so the
  two cannot drift apart.

`make aws-destroy` deletes everything, database included, with no snapshot left
behind. Accounts opened after July 2025 get credits instead of the classic free
tier — check your billing console rather than assuming.

### Known trade-offs

- The database password reaches the container as a plain environment variable in
  the task definition. Moving it to SSM Parameter Store (free) is the first thing
  to harden.
- ACM certificates are free, so HTTPS adds nothing to the bill.
- S3 (5 GB) and CloudFront (1 TB out, 10M requests/month, always free) cover a
  site this size. Cache invalidations are free up to 1,000 paths a month; each
  deploy spends one.
- One task, one AZ for the database: a deploy has a few seconds of downtime and
  there is no failover. That is the free-tier shape, not a production one.
- A trailing slash on a route (`/meetings/new/`) lands on the 404 page. Next.js
  generates links without one, so this only shows up if a URL is typed that way.

## API

Base path `/api/v1`. Full schema at `/docs`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/meetings?date=&q=&limit=&offset=` | Meetings overlapping a day (today by default) |
| `GET` | `/meetings/{id}` | One meeting |
| `POST` | `/meetings` | Create a meeting |
| `DELETE` | `/meetings/{id}` | Delete a meeting and its participants |
| `GET` | `/health` | Liveness + database check |

Every error uses one envelope:

```json
{ "error": { "code": "validation_error", "message": "…", "details": [{ "field": "ends_at", "message": "…" }] } }
```

### Time handling

Timestamps are stored in UTC and **served with the application timezone's offset**
(`APP_TIMEZONE`, default `Europe/Kyiv`). "Today" is that timezone's calendar day,
and a meeting is listed if it *overlaps* the day — so a 23:00–00:30 meeting appears
on both days. The UI reads the wall-clock time straight from the offset the API
sent, so every client shows the same time as the day it was listed under.

## Layout

```
backend/    FastAPI app (api → services → repositories → models), Alembic, tests
frontend/   Next.js app, shadcn/ui primitives in components/ui
infra/      CloudFormation templates + the ACM script behind the aws-* targets
docker-compose.yml
```

## Continuous integration

`.github/workflows/style.yml` runs on every push to `main` and gates style only:

| Job | Runs | Against |
|-----|------|---------|
| Backend — ruff | `ruff check` (GitHub annotations) + `ruff format --diff` | `backend/` |
| Frontend — ESLint | `npm ci` + `npm run lint` | `frontend/` |

Ruff is pinned to the version the backend image ships (0.16.6) and Node matches
the container's Node 22, so CI and local containers agree on what passes.

Reproduce either job locally:

```bash
make lint                                   # both, through the running containers
cd backend  && uvx ruff@0.16.6 check . && uvx ruff@0.16.6 format --diff .
cd frontend && npm ci && npm run lint
```

There is no deploy (CD) stage — no target is configured yet.

## Development notes

- The backend bind-mounts `./backend`, so `uvicorn --reload` picks up edits live.
- The frontend runs `next dev` in the container with the same bind mount.
- Backend tests run against a real Postgres (`meetings_test`), truncating tables
  between tests; `make test` creates that database if it is missing.
