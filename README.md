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

`infra/` holds three CloudFormation templates: `ecr.yml` (image registry),
`backend.yml` (API and database) and `frontend.yml` (site). `make` reads `.env`,
so the `aws-*` targets pick up the credentials and settings from there; `.env` is
gitignored, so real keys never reach the repository. The AWS CLI runs in the
`amazon/aws-cli` container, so nothing has to be installed on the host besides
Docker (`AWS=aws make aws-deploy` uses a local CLI instead, which is noticeably
faster).

```
browser ──https──→ CloudFront (optional custom domain) → private S3 bucket (Next.js static export)
   └────https──→ Lambda function URL → Lambda → Aurora Serverless v2 :5432
```

Every resource lives in `AWS_REGION`, **us-east-1** by default, which is also
where CloudFront reads its certificates from. There is no API Gateway or load
balancer: the browser calls the API on its function URL, and FastAPI's CORS
settings allow it.

Every stack is tagged `PROJECT_NAME=<value of PROJECT_NAME>`, and every resource
that accepts tags also carries it explicitly in the templates. Filter by it in
Cost Explorer or Resource Groups to see everything the project owns.

### One command

```bash
make aws-whoami   # check the credentials work
make aws-deploy   # backend first, then the frontend built against the backend's URL
```

`aws-deploy` runs the two steps below in order: the frontend bakes the API URL
into its build, so the backend has to exist first. Each step can also run on its
own.

Fill these in `.env` first:

```bash
AWS_ACCESS_KEY_ID=...        # an IAM user, not root access keys
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
PROJECT_NAME=successfulsuccess   # prefixes every resource name, and the PROJECT_NAME tag
AWS_DB_PASSWORD=...          # 8-41 chars, [A-Za-z0-9_-] only
AWS_CORS_ORIGINS=            # empty: follow the frontend's URLs (* until it exists)
AWS_SEED_DEMO_DATA=false     # true seeds demo meetings into an empty database
AWS_FRONTEND_DOMAIN=         # optional, e.g. app.example.com
```

### 1. Backend — Lambda function URL, Aurora Serverless v2

```bash
make aws-deploy-backend   # ECR + build & push + create/update the stack + migrate, prints the URL
```

The API runs as a **Lambda function** from a container image
(`backend/Dockerfile.lambda`): the same FastAPI app, adapted to Lambda by
[Mangum](https://github.com/Kludex/mangum) in `app/lambda_handler.py`. Requests
reach it through its **function URL** (`https://<id>.lambda-url.<region>.on.aws`),
Lambda's own public HTTPS endpoint, and that URL is the backend URL the frontend
is built with. FastAPI keeps doing the routing, CORS and error envelope exactly
as it does locally. `backend/Dockerfile` stays the local/compose image.

The database is an **Aurora Serverless v2** PostgreSQL cluster with one
`db.serverless` writer at the smallest size Aurora allows: it scales between
0 and 1 ACU (`DbMinCapacity`, `DbMaxCapacity`) and **pauses after 5 idle
minutes** (also the minimum), so an unused deployment
pays only for storage. The first connection after a pause waits ~15 s while it
resumes; the function's 60 s timeout covers that.

The function sits in the account's **default VPC**, next to the cluster, so the
database is never public: its security group only accepts the function's. The
function needs nothing else on the network, so there is no NAT gateway.

Migrations run in the same function: invoked directly with
`{"action": "migrate"}` it applies them instead of serving a request. Function
URL events never carry that key, so no web request can trigger it.
`make aws-deploy-backend` invokes it after every deploy, so migrations run once
per deploy rather than racing on each cold start.

The first deploy takes ~15 minutes; Aurora is the slow part. It is idempotent —
run it again to ship a new version. The image is passed to the stack by digest,
not by tag, so every push really does update the function. If the stack is
still busy with an earlier update, the target waits for it rather than failing.

| Command | What it does |
|---------|--------------|
| `make aws-url` | Print the API URL (`/docs` for Swagger, `/health` for the check) |
| `make aws-status` | Stack outputs plus the API function's state |
| `make aws-logs` | Follow the function logs from CloudWatch |
| `make aws-migrate` | Apply migrations again on their own |
| `make aws-destroy` | Delete every stack (asks first — the database goes too) |

The image is built for `AWS_LAMBDA_ARCH` (`x86_64` by default).
`AWS_LAMBDA_ARCH=arm64 make aws-deploy-backend` is ~20% cheaper and builds
natively on Apple Silicon. The image platform follows this variable, so the two
cannot drift apart. The build passes `--provenance=false` because Lambda rejects
the multi-manifest image index that BuildKit otherwise pushes.

### 2. Frontend — S3 + CloudFront

```bash
make aws-deploy-frontend   # create/update the stack, build against the API URL, upload
make aws-frontend-url      # print the site URL
```

The target refuses to run until the backend stack exists. It reads the
backend's function URL from that stack, builds the Next.js **static export** in
Docker with `NEXT_PUBLIC_API_BASE_URL` set to it, syncs the files to a
**private S3 bucket** and invalidates the **CloudFront** distribution in front
of it. The site is served over HTTPS at `https://<id>.cloudfront.net`. A new
distribution takes ~5 minutes to come up.

- The distribution is on CloudFront's **flat-rate Free plan**
  (`AWS::PricingPlanManager::Subscription`): $0 a month for 1M requests and
  100 GB, with no overage charges, WAF and DDoS protection included. The plan
  requires a web ACL of its own, so the stack creates one that allows
  everything. AWS allows 3 Free plans per account and refuses them while the
  account is on the AWS Free Tier; set `AWS_CLOUDFRONT_PLAN=PAY_AS_YOU_GO` there.
  `PricingPlanStatus` in the stack outputs reads `ACTIVE` once it applies.
- The bucket blocks all public access. CloudFront reads it through **origin
  access control**, and the bucket policy admits only this distribution.
- The export is built with `trailingSlash`, so each route is a folder with an
  `index.html` (`/meetings/new/`). A small CloudFront Function maps clean URLs
  onto those files, since S3's REST endpoint has no index documents. Anything
  missing gets the export's `404.html` with a 404 status.
  `output` stays `standalone` for the compose/production image and switches to
  `export` only when `NEXT_OUTPUT=export` is set, which is the deploy target's
  job.
- HTML is uploaded with `no-cache` and the hashed assets with a one-year
  immutable header, and every deploy invalidates `/*`, so a new version shows up
  on the next page load.
- With `AWS_CORS_ORIGINS` empty, the backend allows exactly the frontend's
  origins (the CloudFront URL and the custom domain). On the very first
  `make aws-deploy` the frontend does not exist yet, so the API starts with `*`;
  the frontend step says so, and the next `make aws-deploy-backend` locks it down.

### 3. Custom domain for the frontend (optional)

```bash
# .env
AWS_FRONTEND_DOMAIN=app.example.com

make aws-frontend-cert      # request + DNS-validate the certificate in us-east-1
make aws-deploy-frontend    # attach the domain to the distribution
make aws-deploy-backend     # add the new origin to the API's CORS
```

CloudFront only reads ACM certificates from **us-east-1**, and that is where
everything is deployed. `make aws-frontend-cert` (`infra/certificate.sh`) reuses
an issued or pending certificate for the domain, or requests one, then waits for
DNS validation. If the domain's Route 53 hosted zone is in this account, it
writes the validation record itself, and the frontend stack adds the A/AAAA
alias records pointing at the distribution. Otherwise both print the records
to add at your DNS provider: the validation CNAME, then a CNAME from the domain
to the distribution's `*.cloudfront.net` name.

The API keeps its function URL: a function URL cannot take a custom domain.

### Cost

- **Lambda** — 1M requests and 400,000 GB-seconds a month, always free. The
  function URL costs nothing beyond the invocation.
- **Aurora Serverless v2** is not in the free tier. It bills per ACU-hour while
  awake, nothing for compute while paused, plus storage and I/O. A demo that
  sits idle costs cents a month.
- **CloudFront** — the flat-rate Free plan: $0, 1M requests and 100 GB a month,
  never an overage charge (traffic past it may be slowed, not billed).
  **S3** — 5 GB and 20,000 GETs in the free tier; CloudFront caches most reads.
  ACM certificates are free.
- **ECR** — 500 MB in the free tier; the lifecycle policy keeps five images.

`make aws-destroy` deletes everything, database included, with no snapshot left
behind. Accounts opened after July 2025 get credits instead of the classic free
tier — check your billing console rather than assuming.

### Known trade-offs

- **No custom domain on the API**: function URLs cannot take one. Putting one on
  it would need API Gateway or a second CloudFront distribution in front.
- The database password reaches the function as a plain environment variable.
  Moving it to SSM Parameter Store or Secrets Manager is the first thing to
  harden.
- **Cold starts**: the first request after a few idle minutes waits ~1–2 s while
  Lambda starts the container, and up to ~15 s more if Aurora has paused.
- Every warm instance holds one database connection. Nothing is reserved by
  default (`MaxConcurrency=0`): new accounts have a Lambda concurrency limit of
  10 in total and Lambda refuses to reserve any of it, so that limit is the cap,
  well under the cluster's connection limit. Once the limit is raised, set
  `MaxConcurrency` to keep a spike off the database; requests beyond it get
  HTTP 429. RDS Proxy is the proper fix, and it is not free.
- The function URL is public, like the local API: there is no authentication
  and no request throttling in front of it beyond the concurrency limit.
- Deleting the backend stack takes ~20 minutes: Lambda releases its VPC network
  interfaces slowly, and the security groups wait for them.
- One Aurora instance: there is no reader to fail over to.

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
infra/      CloudFormation templates behind the aws-* targets
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
