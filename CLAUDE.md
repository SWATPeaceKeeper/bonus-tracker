# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bonus Tracker is a full-stack app replacing an Excel-based Pre-Sales Bonus Tracker. It processes Clockify CSV time-tracking exports, calculates bonuses with remote/onsite hour split, and generates finance/customer reports with PDF export. Includes a revenue KPI dashboard for project-level deal tracking.

## Tech Stack

- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy 2.0 async / SQLite (aiosqlite) / WeasyPrint (PDF)
- **Frontend:** React 19 / TypeScript / Vite / Tailwind CSS 4 / shadcn/ui / React Router 7
- **Package managers:** `uv` (backend), `npm` (frontend)
- **Deployment:** Docker multi-stage builds, Nginx reverse proxy, GHCR, multi-arch (amd64/arm64)

## Common Commands

### Backend (from `backend/`)

```bash
uv sync                              # Install dependencies
uvicorn app.main:app --reload        # Dev server on :8000
pytest -q                            # Run all tests
pytest tests/test_csv_parser.py -q   # Run single test file
pytest -k "test_name" -q             # Run single test by name
ruff check app tests                 # Lint
ruff format app tests                # Format
```

### Frontend (from `frontend/`)

```bash
npm ci                  # Install dependencies
npm run dev             # Dev server on :5173 (proxies /api → localhost:8000)
npm run build           # Production build
npm run lint            # ESLint
```

### Docker

```bash
docker compose up --build                         # Dev (local builds)
docker compose -f docker-compose.prod.yml up      # Prod (GHCR images)
```

## Architecture

### Backend (`backend/app/`)

Layered async FastAPI application:

- **`main.py`** — App factory, lifespan (creates tables on startup), CORS middleware, router registration
- **`models.py`** — SQLAlchemy ORM: `Project`, `TimeEntry`, `ImportBatch`, `CustomerReportNote`
- **`schemas.py`** — Pydantic request/response models
- **`config.py`** — Pydantic Settings (DATABASE_URL, CORS_ORIGINS, DEFAULT_BONUS_RATE)
- **`database.py`** — Async engine, session factory, `get_db` dependency
- **`routers/`** — `projects`, `imports`, `reports`, `exports`, `time_entries`
- **`services/`** — `csv_parser` (Clockify format), `bonus_calculator`, `pdf_generator` (WeasyPrint)

Database dependency injection via `get_db` AsyncSession. Projects carry computed `total_hours`, `remote_hours`, `onsite_hours`, and `bonus_amount` (aggregated at query time, not stored).

### Frontend (`frontend/src/`)

SPA with lazy-loaded pages:

- **`api/client.ts`** — Fetch wrapper (get/post/put/del/uploadFile) hitting `/api`
- **`hooks/useApi.ts`** — Generic data-fetching hook with loading/error/refetch
- **`pages/`** — Dashboard, Projects, ProjectDetail, Import, FinanceReport, BonusOverview, CustomerReport, Revenue
- **`components/ui/`** — shadcn/ui primitives (install new ones via `npx shadcn@latest add <component>`)
- **`types/index.ts`** — TypeScript interfaces mirroring backend schemas
- **`lib/utils.ts`** — Formatters (currency, numbers, dates)

Vite dev server proxies `/api` to `localhost:8000` — run backend and frontend separately for local dev.

### Data Model

- **Project** — Clockify project with bonus config (hourly_rate, onsite_hourly_rate, bonus_rate, budget_hours, status, project_manager, customer_contact)
- **TimeEntry** — Individual time log linked to Project and ImportBatch, indexed by `month` (YYYY-MM), with `is_onsite` flag
- **ImportBatch** — Tracks each CSV upload (filename, row_count, timestamp)
- **CustomerReportNote** — Per-project, per-month editable notes for customer reports

Project status values: `aktiv`, `pausiert`, `abgeschlossen` (German).

### Bonus Calculation

```
remote_bonus = remote_hours * hourly_rate * bonus_rate
onsite_bonus = onsite_hours * (onsite_hourly_rate or hourly_rate) * bonus_rate
total_bonus = remote_bonus + onsite_bonus
```

`calculate_bonus()` in `services/bonus_calculator.py` takes 5 params: `remote_hours`, `onsite_hours`, `hourly_rate`, `onsite_hourly_rate`, `bonus_rate`. All callers (projects, reports, exports) query remote/onsite hours separately via `TimeEntry.is_onsite`.

### Nginx (`frontend/nginx.conf`)

Reverse proxy: `/api/` → backend:8000, `/health` → backend, everything else → SPA fallback (index.html).

## Environment Variables

```
DATABASE_URL=sqlite+aiosqlite:///data/bonus_tracker.db
CORS_ORIGINS=["http://localhost:5173"]
DEFAULT_BONUS_RATE=0.02
VITE_API_BASE_URL=/api          # Frontend (optional, defaults to /api)
```

### PDF Generation

Customer and finance PDFs are generated via WeasyPrint in `services/pdf_generator.py`:

- **Customer PDF** (`generate_customer_pdf`) — Takes `month` (YYYY-MM), not year. Includes signature fields for project_manager and customer_contact. Full A4 layout, no creation date.
- **Finance PDF** (`generate_finance_pdf`) — Accepts optional `month_str` for monthly export. Without it, generates yearly overview.
- Docker image includes `de_DE.UTF-8` locale for correct German number formatting.

## Security Patterns

- **HTML in PDFs:** All user-controlled strings must be passed through `html.escape()` before embedding in WeasyPrint HTML templates (`pdf_generator.py`). This prevents HTML injection, content spoofing, and SSRF via external resource loading.
- **CSV export:** Use `csv.writer` with `csv.QUOTE_ALL` — never build CSV with f-strings. Prefix formula-triggering characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with `'` via `_defuse_formula()` to prevent spreadsheet formula injection.
- **HTTP filenames:** Use `safe_filename()` from `pdf_generator.py` to sanitize user input in `Content-Disposition` headers. Never interpolate raw user strings into HTTP headers.

## Linting Configuration

- **Python (ruff):** line-length=100, target py311, rules: E F W I N UP B A SIM TCH
- **TypeScript (ESLint):** React Hooks + React Refresh rules, TS recommended
- **Both:** Zero warnings policy — fix all warnings before committing

## Testing

Backend only. Tests use in-memory SQLite (`sqlite+aiosqlite://`), async pytest with `ASGITransport` httpx client. Fixtures in `tests/conftest.py` override the `get_db` dependency. No frontend tests currently.

## CI/CD

GitHub Actions workflow (`.github/workflows/docker-build.yml`): two parallel jobs (`build-backend`, `build-frontend`) build and push Docker images to GHCR on push to `main` or semantic version tags (`v*.*.*`). Multi-platform: linux/amd64 + linux/arm64. Uses GHA cache for BuildKit layers.
