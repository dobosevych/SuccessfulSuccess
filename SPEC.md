# SuccessfulSuccess — Meetings App Specification

Version: 1.1 — 2026-09-10
Status: Implemented. This document tracks what was built; deviations from the
original 1.0 draft are called out in §10.

---

## 1. Overview

A small web application for tracking meetings. The main page shows the meetings
scheduled for **today** (name, description, participants). A user can create a new
meeting from the UI; if the meeting is scheduled for today it appears immediately in
the list.

The whole system (frontend, backend, database) starts with a single
`docker compose up`.

### 1.1 Goals

- Monorepo with a clear `frontend/` + `backend/` split.
- FastAPI backend with a typed REST API and PostgreSQL persistence.
- React frontend using **shadcn/ui** as the design system.
- One-command local startup via Docker Compose.
- Today's meetings list + create-meeting flow working end to end.

### 1.2 Non-goals (v1)

- Authentication / user accounts / authorization.
- Recurring meetings, invitations, notifications, e-mail.
- Calendar integrations (Google/Outlook), timezone selection per user.
- Editing meetings (delete ships in v1; edit is deferred to v2).
- Real-time updates (WebSockets) — the list refreshes on navigation/mutation.

---

## 2. Architecture

```
┌────────────────┐        HTTP/JSON        ┌────────────────┐      asyncpg      ┌────────────┐
│   frontend     │ ─────────────────────▶  │    backend     │ ────────────────▶ │  postgres  │
│  Next.js 16    │   /api/v1/meetings      │  FastAPI       │   SQLAlchemy 2    │    17      │
│  shadcn/ui     │ ◀─────────────────────  │  Pydantic v2   │ ◀──────────────── │            │
└────────────────┘                         └────────────────┘                   └────────────┘
     :3000                                       :8000                              :5432
```

- The frontend calls the backend directly over HTTP using a base URL from an
  environment variable. CORS is enabled on the backend for the frontend origin.
- All three services run as containers on a shared Docker network; Postgres data
  lives in a named volume so it survives restarts.
- Timezone: the server stores all timestamps in **UTC** (`TIMESTAMPTZ`). "Today" is
  computed in the application timezone configured by `APP_TIMEZONE`
  (default `Europe/Kyiv`), not in the browser's timezone, so all clients agree.

### 2.1 Repository layout

```
SuccessfulSuccess/
├─ README.md
├─ SPEC.md
├─ docker-compose.yml
├─ .env.example
├─ Makefile                       # convenience targets: up, down, logs, migrate, seed, test, lint
├─ backend/
│  ├─ Dockerfile
│  ├─ pyproject.toml              # uv-managed
│  ├─ uv.lock
│  ├─ alembic.ini
│  ├─ entrypoint.sh                # runs `alembic upgrade head`, then the CMD
│  ├─ alembic/
│  │  ├─ env.py
│  │  ├─ script.py.mako
│  │  └─ versions/
│  │     └─ 0001_create_meetings.py
│  ├─ app/
│  │  ├─ __init__.py
│  │  ├─ main.py                  # FastAPI app factory, CORS, router mounting, /health
│  │  ├─ config.py                # pydantic-settings Settings
│  │  ├─ errors.py                # the single error envelope + handlers
│  │  ├─ db.py                    # async engine, session factory, get_session dependency
│  │  ├─ models/
│  │  │  ├─ __init__.py
│  │  │  └─ meeting.py            # Meeting, Participant ORM models
│  │  ├─ schemas/
│  │  │  ├─ __init__.py
│  │  │  └─ meeting.py            # MeetingCreate, MeetingRead, ParticipantRead, ...
│  │  ├─ repositories/
│  │  │  └─ meeting.py            # DB queries, no HTTP concerns
│  │  ├─ services/
│  │  │  └─ meeting.py            # business rules (validation, "today" window)
│  │  ├─ api/
│  │  │  ├─ deps.py
│  │  │  └─ v1/
│  │  │     ├─ __init__.py        # APIRouter(prefix="/api/v1")
│  │  │     └─ meetings.py        # endpoints
│  │  └─ seed.py                  # optional demo data
│  └─ tests/
│     ├─ conftest.py              # test DB, httpx AsyncClient
│     ├─ test_meetings_api.py
│     └─ test_today_window.py
└─ frontend/
   ├─ Dockerfile
   ├─ package.json
   ├─ next.config.ts
   ├─ tsconfig.json
   ├─ components.json             # shadcn/ui config
   ├─ tailwind.config.ts / app/globals.css
   ├─ .env.example
   ├─ app/
   │  ├─ layout.tsx               # shell: header + navigation menu
   │  ├─ page.tsx                 # "/" → today's meetings
   │  ├─ globals.css              # design tokens + Canva theme layer
   │  └─ meetings/
   │     └─ new/page.tsx          # same screen with the dialog already open
   ├─ components/
   │  ├─ ui/                      # shadcn generated primitives
   │  ├─ providers.tsx            # TanStack Query + tooltip providers
   │  ├─ today-page.tsx           # header + list + dialog, shared by both routes
   │  ├─ app-header.tsx           # brand + nav menu (lists today's meetings)
   │  ├─ meeting-list.tsx
   │  ├─ meeting-card.tsx
   │  ├─ create-meeting-dialog.tsx
   │  └─ participants-input.tsx
   ├─ lib/
   │  ├─ api.ts                   # typed fetch client
   │  ├─ types.ts                 # mirrors backend schemas
   │  ├─ datetime.ts              # time formatting, initials
   │  └─ utils.ts                 # cn()
   └─ hooks/
      └─ use-meetings.ts          # TanStack Query hooks
```

---

## 3. Domain model

### 3.1 Entities

**Meeting**

| Field         | Type          | Rules |
|---------------|---------------|-------|
| `id`          | UUID (v4)     | PK, server-generated |
| `name`        | string        | required, 1–200 chars, trimmed, non-blank |
| `description` | string \| null| optional, ≤ 2000 chars |
| `starts_at`   | timestamptz   | required |
| `ends_at`     | timestamptz   | required, must be `> starts_at` |
| `location`    | string \| null| optional, ≤ 200 chars (room / link) |
| `created_at`  | timestamptz   | server-generated, default `now()` |
| `updated_at`  | timestamptz   | server-generated, updated on change |

**Participant**

| Field        | Type           | Rules |
|--------------|----------------|-------|
| `id`         | UUID (v4)      | PK |
| `meeting_id` | UUID           | FK → `meetings.id`, `ON DELETE CASCADE` |
| `name`       | string         | required, 1–120 chars, trimmed |
| `email`      | string \| null | optional, validated e-mail, ≤ 255 chars |
| `position`   | int            | ordering within the meeting, 0-based |

Relationship: `Meeting 1 ── n Participant` (composition — participants have no life
outside a meeting in v1).

### 3.2 Invariants

1. `ends_at > starts_at`.
2. A meeting has **0 or more** participants; duplicates by (name, email) within the
   same meeting are rejected with `422`.
3. Maximum 50 participants per meeting.
4. `name` after trimming must be non-empty.

### 3.3 Database schema (PostgreSQL 17)

```sql
CREATE TABLE meetings (
    id          UUID PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    description TEXT          NULL,
    location    VARCHAR(200)  NULL,
    starts_at   TIMESTAMPTZ   NOT NULL,
    ends_at     TIMESTAMPTZ   NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT meetings_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX ix_meetings_starts_at ON meetings (starts_at);

CREATE TABLE participants (
    id         UUID PRIMARY KEY,
    meeting_id UUID         NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    email      VARCHAR(255) NULL,
    position   INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX ix_participants_meeting_id ON participants (meeting_id);
```

Schema is created and evolved with **Alembic** migrations only (never
`create_all` in production paths); migrations run automatically on backend
container start.

---

## 4. Backend specification

### 4.1 Stack

| Concern      | Choice |
|--------------|--------|
| Language     | Python 3.12 |
| Framework    | FastAPI (latest 0.11x) |
| Validation   | Pydantic v2 + pydantic-settings |
| ORM          | SQLAlchemy 2.0 (async) |
| Driver       | asyncpg |
| Migrations   | Alembic |
| Server       | uvicorn (`--reload` in dev) |
| Package mgmt | uv |
| Tests        | pytest, pytest-asyncio, httpx `ASGITransport` |
| Lint/format  | ruff |

### 4.2 Configuration (env vars)

| Variable                   | Default (compose)                                            | Purpose |
|----------------------------|--------------------------------------------------------------|---------|
| `DATABASE_URL`             | `postgresql+asyncpg://app:app@db:5432/meetings`              | DB DSN |
| `APP_TIMEZONE`             | `Europe/Kyiv`                                                | Defines "today" |
| `CORS_ORIGINS`             | `http://localhost:3000`                                      | Comma-separated |
| `LOG_LEVEL`                | `INFO`                                                       | |
| `RUN_MIGRATIONS_ON_START`  | `true`                                                       | Entry-point runs `alembic upgrade head` |
| `SEED_DEMO_DATA`           | `false`                                                      | Insert demo meetings if DB empty |

### 4.3 REST API — `/api/v1`

All responses are JSON. All datetimes are ISO-8601 with offset
(`2026-09-10T14:00:00+03:00`); inputs without an offset are rejected with `422`.
Postgres returns UTC, so `MeetingRead` re-serializes every timestamp into
`APP_TIMEZONE` before it leaves the API. The UI then reads the wall-clock time
directly out of that string instead of converting to the browser's timezone, so
a client in any timezone shows the same times as the day window the meeting was
listed under.

#### `GET /health`
Liveness + DB check.
```json
{ "status": "ok", "database": "ok", "version": "1.0.0" }
```
`503` if the DB is unreachable.

#### `GET /api/v1/meetings`
List meetings.

Query parameters:

| Param    | Type   | Default | Meaning |
|----------|--------|---------|---------|
| `date`   | `YYYY-MM-DD` | today in `APP_TIMEZONE` | Return meetings **overlapping** that calendar day |
| `q`      | string | –       | Case-insensitive substring match on name/description |
| `limit`  | int    | 100     | 1–500 |
| `offset` | int    | 0       | ≥ 0 |

"Overlapping day D" means `starts_at < end_of_D` **and** `ends_at > start_of_D`,
where the day boundaries are computed in `APP_TIMEZONE` and converted to UTC.
So a meeting from 23:00 to 00:30 shows on both days.

Sorted by `starts_at ASC, name ASC`.

Response `200`:
```json
{
  "items": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Sprint planning",
      "description": "Plan the next two weeks",
      "location": "Room 3 / meet.link/abc",
      "starts_at": "2026-09-10T10:00:00+03:00",
      "ends_at":   "2026-09-10T11:00:00+03:00",
      "participants": [
        { "id": "…", "name": "Ostap", "email": "ostap@example.com", "position": 0 },
        { "id": "…", "name": "Iryna", "email": null,                "position": 1 }
      ],
      "created_at": "2026-09-09T18:20:11+03:00",
      "updated_at": "2026-09-09T18:20:11+03:00"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0,
  "date": "2026-09-10"
}
```

#### `GET /api/v1/meetings/{id}`
`200` with a single `MeetingRead`; `404` if not found.

#### `POST /api/v1/meetings`
Create a meeting.

Request body:
```json
{
  "name": "Sprint planning",
  "description": "Plan the next two weeks",
  "location": "Room 3",
  "starts_at": "2026-09-10T10:00:00+03:00",
  "ends_at": "2026-09-10T11:00:00+03:00",
  "participants": [
    { "name": "Ostap", "email": "ostap@example.com" },
    { "name": "Iryna" }
  ]
}
```
- `201 Created`, body = full `MeetingRead`, header `Location: /api/v1/meetings/{id}`.
- `422` on validation failure (see error format below).

#### `DELETE /api/v1/meetings/{id}` *(v1, minimal)*
`204 No Content`; `404` if missing. Cascades to participants.

#### Error format

Every non-2xx response uses:
```json
{
  "error": {
    "code": "validation_error",
    "message": "Meeting must end after it starts.",
    "details": [ { "field": "ends_at", "message": "must be later than starts_at" } ]
  }
}
```
Codes: `validation_error` (422), `not_found` (404), `internal_error` (500),
`service_unavailable` (503). Implemented via custom exception handlers so
FastAPI's default `{"detail": ...}` shape never leaks.

### 4.4 Layering rules

- `api/` — HTTP only: parse/validate, call a service, map to response models.
- `services/` — business rules, timezone/day-window math, invariants.
- `repositories/` — SQLAlchemy queries; return ORM objects or scalars.
- `models/` — ORM. `schemas/` — Pydantic I/O models. These are separate types;
  ORM objects are converted with `MeetingRead.model_validate(obj)`
  (`from_attributes=True`).
- Participants are always loaded eagerly (`selectinload`) to avoid N+1.

### 4.5 OpenAPI

Auto-generated, served at `/docs` (Swagger) and `/openapi.json`. Every endpoint
has a `summary`, `response_model`, and documented error responses.

### 4.6 Backend tests (must pass in CI/`make test`)

1. `POST /meetings` → `201`, response contains generated id and participants in order.
2. `POST` with `ends_at <= starts_at` → `422` with `error.code == "validation_error"`.
3. `POST` with blank name → `422`.
4. `POST` with duplicate participant → `422`.
5. `GET /meetings` with no `date` returns only meetings overlapping today.
6. A meeting spanning midnight appears in both days' results.
7. `GET /meetings/{unknown}` → `404` in the standard error shape.
8. `DELETE` removes the meeting and its participants.
9. `GET /health` → `200` with `database: "ok"`.

Tests run against a real Postgres (a `db-test` service or the same instance with a
separate database), each test in a rolled-back transaction.

---

## 5. Frontend specification

### 5.1 Stack

| Concern       | Choice |
|---------------|--------|
| Framework     | Next.js 16 (App Router), React 19, TypeScript strict |
| Design system | **shadcn/ui** (Radix + Tailwind CSS v4), `radix-nova` preset |
| Visual style  | Canva-inspired theme layered on the shadcn tokens (§5.7) |
| Icons         | lucide-react |
| Data fetching | TanStack Query v5 (client components) |
| Forms         | react-hook-form + zod + `@hookform/resolvers` |
| Dates         | date-fns |
| Notifications | `sonner` toaster (shadcn) |

shadcn components generated: `button`, `card`, `dialog`, `field`, `input`,
`textarea`, `label`, `badge`, `avatar`, `separator`, `skeleton`, `sonner`,
`navigation-menu`, `scroll-area`, `tooltip`, `popover`, `calendar`, `select`,
`alert`, `dropdown-menu`. (`form` is no longer in the registry — the current
shadcn form primitive is `field`; the create form uses react-hook-form directly
with `Label`/`Input` and inline error text.)

### 5.2 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ▣ SuccessfulSuccess    [ Today ▾ (nav menu of today's meetings) ]   [ + New meeting ] │
├─────────────────────────────────────────────────────────────────┤
│  Today — Thursday, 10 September 2026            3 meetings      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 10:00 – 11:00   Sprint planning                Room 3     │  │
│  │ Plan the next two weeks                                   │  │
│  │ ( OS )( IR )( +2 )  Ostap, Iryna, +2                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 14:00 – 14:30   Design review                             │  │
│  │ …                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Screens & components

**`/` — Today's meetings (main page)**
- Header with today's date (formatted in `APP_TIMEZONE`) and the meeting count.
- `MeetingList` renders `MeetingCard` items sorted by start time.
- `MeetingCard` (shadcn `Card`): time range badge, name (`CardTitle`),
  description (`CardDescription`, clamped to 3 lines), optional location,
  participants as an avatar stack (initials, max 4 shown, `+N` overflow) with a
  tooltip listing all names.
- Loading: 3 `Skeleton` cards. Error: `Alert` with a Retry button.
- Empty state: centered card — "No meetings today" + a "Schedule one" button that
  opens the create dialog.

**Navigation menu (requirement 6)**
- `AppHeader` contains a shadcn `NavigationMenu` with a "Today" item whose dropdown
  lists today's meetings (time + name), each linking/scrolling to its card.
- The menu and the list read the **same** TanStack Query cache key
  (`["meetings", { date }]`), so a newly created meeting appears in both without a
  page reload.

**Create meeting**
- `CreateMeetingDialog` (shadcn `Dialog` + `Form`), opened from the header button,
  the empty state, or the `/meetings/new` route (same component, page-hosted).
- Fields: Name (required), Description (textarea), Location, Date (`Calendar` in a
  `Popover`, defaults to today), Start time, End time (time inputs, 15-min steps),
  Participants (`ParticipantsInput`: name + optional email rows, add/remove,
  keyboard `Enter` adds a row).
- Client-side zod validation mirrors the server rules; server `422` `details` are
  mapped back onto the matching form fields.
- On success: `queryClient.invalidateQueries(["meetings"])`, close the dialog,
  `toast.success("Meeting created")`. On failure: inline errors + error toast; the
  dialog stays open with the entered data.
- Optimistic insert is **not** used in v1 — the create call is fast and correctness
  is simpler.

### 5.4 API client

`lib/api.ts` exposes `listMeetings({date, q})`, `getMeeting(id)`,
`createMeeting(payload)`, `deleteMeeting(id)`. It reads
`process.env.NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`), throws a
typed `ApiError { code, message, details }` parsed from the standard error body,
and types responses from `lib/types.ts`, which mirrors the backend schemas 1:1.

### 5.5 Accessibility & UX

- Dialog traps focus and is reachable/closable by keyboard (Radix default).
- Every input has a `<Label>`; errors are announced via `aria-describedby`.
- Colour contrast ≥ WCAG AA in both light and dark themes (shadcn tokens).
- Responsive: single column below 768px; the header collapses the nav into a
  dropdown menu.

### 5.6 Frontend checks

- `npm run build` and `tsc --noEmit` pass with `strict: true`.
- `npm run lint` (ESLint, Next config) passes.
- Manual acceptance walk-through per §7.

### 5.7 Visual style — Canva

The shadcn primitives keep their behaviour; only the design tokens and a few
shape classes change. Reference: canva.com.

**Palette** (`app/globals.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--canva-violet` | `#8b3dff` | primary buttons, focus rings, accents |
| `--canva-violet-deep` | `#7d2ae8` | accent foreground |
| `--canva-teal` | `#00c4cc` | gradient start |
| `--canva-blue` | `#4a5cff` | gradient middle |
| `--canva-pink` | `#ff2e93` | gradient end |
| `--canva-ink` | `#0f1015` | body text |
| `--border` | `#e7dbff` | lavender hairline |
| `--secondary` / `--muted` | `rgba(64,79,109,.06)` | quiet surfaces |

**Shape and type**

- Buttons, badges, chips, inputs and avatars are full pills (`border-radius: 9999px`);
  cards use `rounded-3xl`.
- Cards carry a soft two-layer shadow and a 5% ring instead of a hard border, and
  lift slightly on hover.
- Labels are `font-semibold`; headings are `font-bold` in Geist Sans.

**Signature elements**

- `.text-gradient-canva` — teal → blue → violet → pink gradient clipped to text,
  used on the "Today" headline.
- A gradient circle holds the calendar glyph in the header and the empty state.
- `.tint-violet` / `.tint-teal` / `.tint-pink` / `.tint-amber` — pastel chips that
  rotate by card position, the way Canva colour-codes its template tiles.
- A soft teal-and-violet radial wash sits behind the page.

All of the above are defined for dark mode too, though the app currently ships
light-only (no theme toggle).

---

## 6. Docker & local development

### 6.1 Services (`docker-compose.yml`)

| Service    | Image / build       | Ports         | Depends on            |
|------------|---------------------|---------------|-----------------------|
| `db`       | `postgres:17-alpine`| `5432:5432`   | –                     |
| `backend`  | `./backend`         | `8000:8000`   | `db` (healthy)        |
| `frontend` | `./frontend`        | `3000:3000`   | `backend` (started)   |

- `db`: env `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`, `POSTGRES_DB=meetings`;
  named volume `pgdata:/var/lib/postgresql/data`;
  healthcheck `pg_isready -U app -d meetings` (interval 5s, retries 10).
- `backend`: waits for `db: condition: service_healthy`, entrypoint runs
  `alembic upgrade head` then `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`;
  bind-mounts `./backend:/app` for hot reload; healthcheck `GET /health`.
- `frontend`: dev command `npm run dev -- -p 3000 -H 0.0.0.0`; bind-mounts
  `./frontend:/app` with an anonymous volume for `/app/node_modules`;
  `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` (browser-side URL, so it points at
  the host-published port, not the compose service name).
- All values come from `.env` (copied from `.env.example`); compose reads it
  automatically.

### 6.2 Dockerfiles

- **backend**: `python:3.12-slim`, install `uv`, `uv sync --frozen --no-dev`
  (dev deps included when `INSTALL_DEV=true`), non-root user, `EXPOSE 8000`.
- **frontend**: `node:22-alpine`; dev stage installs all deps and runs `next dev`.
  A `production` target (`next build` + `next start` as a non-root user) is defined
  but not used by the default compose file.

### 6.3 Acceptance for requirement 4

From a clean checkout:

```bash
cp .env.example .env
docker compose up --build
```

produces:
- `http://localhost:3000` — today's meetings page rendering data from the API,
- `http://localhost:8000/docs` — Swagger UI,
- `http://localhost:8000/health` — `{"status":"ok","database":"ok"}`,
- database schema created by Alembic with no manual step.

`docker compose down -v` removes everything including data.

### 6.4 Makefile targets

`up`, `up-build`, `down`, `down-v`, `logs`, `ps`, `migrate`, `revision m="..."`,
`seed`, `test`, `lint`, `fmt`, `shell-backend`, `psql`.

---

## 7. Acceptance criteria

| # | Requirement | Acceptance test |
|---|-------------|-----------------|
| 1 | Monorepo with `frontend/` and `backend/` | Both directories exist, each independently buildable/runnable |
| 2 | Backend uses FastAPI | `/docs` served by FastAPI; endpoints of §4.3 respond as specified |
| 3 | Frontend uses shadcn | `components.json` present; `components/ui/*` generated; UI built from those primitives |
| 4 | One-command startup | `docker compose up --build` yields the three working endpoints of §6.3 |
| 5 | Main page lists today's meetings | `/` shows name, description and participants for every meeting overlapping today, sorted by start time |
| 6 | Add a meeting; it appears in the menu | Submitting the create form returns `201`, closes the dialog, and the new meeting is visible in both the list and the header nav menu without a page reload |
| 7 | Spec-first | This document is reviewed and approved before any code is generated |

Additionally: all backend tests in §4.6 pass; `ruff check` and the frontend
`lint`/`build` succeed.

---

## 8. Implementation plan (for the generation step)

1. Repo scaffolding: `.gitignore`, `.env.example`, `README.md`, `Makefile`,
   `docker-compose.yml`.
2. Backend: `pyproject.toml`, config, db session, models, Alembic migration `0001`.
3. Backend: schemas → repository → service → API router → error handlers → `/health`.
4. Backend tests.
5. Frontend: Next.js app, Tailwind + shadcn init, generate UI components.
6. Frontend: types + API client + TanStack Query provider.
7. Frontend: layout/header/nav menu, meeting list & card, empty/loading/error states.
8. Frontend: create-meeting dialog, form validation, cache invalidation, toasts.
9. Dockerfiles, wire up compose, verify §6.3 end to end.
10. Seed data + README quick start.

## 9. Open questions (assume the stated default unless told otherwise)

1. **Timezone** — default `Europe/Kyiv` for the "today" window. Should it be UTC or
   browser-local instead?
2. **Participants** — free-text name (+ optional email) rather than a `users` table.
   Confirm no user directory is needed in v1.
3. **Edit meetings** — v1 ships create/list/delete only; edit deferred to v2.

---

## 10. Deviations from the 1.0 draft

Recorded during implementation; each was verified working.

| # | Draft said | Built | Why |
|---|------------|-------|-----|
| 1 | Next.js 15 | Next.js 16 | `create-next-app@latest` installs 16; no code changes needed. |
| 2 | shadcn `form` component, `new-york`/`slate` | `field` component, `radix-nova` preset | `form` is no longer in the shadcn registry; the CLI's presets replaced the old style/base-color flags. The create form uses react-hook-form + zod directly with `Label`/`Input` and inline errors. |
| 3 | Timestamps served as stored | Re-serialized into `APP_TIMEZONE` | Postgres returns UTC; without this a browser in another timezone renders times that contradict the day window. |
| 4 | Errors from model-level validators | Attached to the responsible field | Pydantic reports `model_validator` errors with an empty location, so `details[].field` was blank and the UI could not map them back onto inputs. Moved to `field_validator`s on `ends_at` and `participants`. |
| 5 | Test isolation by transaction rollback | Truncate between tests | Sharing one asyncpg connection between the test session and the ASGI request raised `another operation is in progress`. |
| 6 | Visual design left to shadcn defaults | Canva-inspired theme (§5.7) | Added after the first review pass. |

## 11. Known gaps

- No dark-mode toggle, though every token has a dark value.
- The nav menu lists only today; other days are reachable through the API's
  `date` parameter but not yet through the UI.
- Delete exists in the API but has no UI control.
