# Bonus Tracker

Web-based Pre-Sales Bonus Tracker that replaces manual Excel workflows. Imports time tracking data from Clockify CSV exports, calculates bonuses per project, and generates finance and customer reports with PDF export.

## Features

- **Clockify CSV Import** — Upload detailed time reports, auto-create projects, detect duplicates
- **Project Management** — Track projects with hourly rates, onsite rates, bonus rates, budgets, project manager, and customer contact
- **Remote/OnSite Tracking** — Mark time entries as on-site with separate hourly rate for bonus calculation
- **Finance Report** — Monthly or yearly bonus summary per project with CSV/PDF export
- **Customer Report** — Per-project monthly report with signature fields for PM and customer, PDF export
- **Revenue Dashboard** — KPIs for deal values, revenue (hours x rate), and budget utilization
- **Bonus Dashboard** — KPIs for active projects, current month hours, and bonus totals

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 (async), SQLite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui |
| PDF | WeasyPrint |
| Deployment | Docker (multi-arch), Nginx, Traefik, GHCR |

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

The app is available at `http://localhost` (frontend) with API at `http://localhost/api`.

### Local Development

**Backend** (requires Python 3.11+ and [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync
uvicorn app.main:app --reload    # http://localhost:8000
```

**Frontend** (requires Node 22+):

```bash
cd frontend
npm ci
npm run dev                       # http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

### Production

```bash
docker compose -f docker-compose.prod.yml up
```

Uses pre-built images from GHCR. Set `BONUS_VERSION` to pin a specific version (defaults to `latest`).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///data/bonus_tracker.db` | Database connection string |
| `CORS_ORIGINS` | `[]` | Allowed CORS origins (JSON array) |
| `DEFAULT_BONUS_RATE` | `0.02` | Default bonus rate for new projects (2%) |
| `VITE_API_BASE_URL` | `/api` | Frontend API base URL |

## Bonus Calculation

```
remote_bonus = remote_hours x hourly_rate x bonus_rate
onsite_bonus = onsite_hours x onsite_hourly_rate x bonus_rate
total_bonus  = remote_bonus + onsite_bonus
```

If no onsite hourly rate is set, the standard hourly rate is used for on-site hours as well.

Example: 80 remote hours at 120 EUR/h + 20 onsite hours at 150 EUR/h with 2% bonus rate = 192 + 60 = 252 EUR bonus.

## License

Private project. All rights reserved.
