# Bonus Tracker

Web-based Pre-Sales Bonus Tracker that replaces manual Excel workflows. Imports time tracking data from Clockify CSV exports, calculates bonuses per project, and generates finance and customer reports with PDF export.

## Features

- **Clockify CSV Import** — Upload detailed time reports, auto-create projects, detect duplicates
- **Project Management** — Track projects with hourly rates, bonus rates, budgets, and status
- **Finance Report** — Monthly bonus summary per project with CSV/PDF export
- **Customer Report** — Per-project monthly hour matrix with detail entries, notes, and PDF export
- **Dashboard** — KPIs for active projects, current month hours, and bonus totals

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
bonus = total_hours x hourly_rate x bonus_rate
```

Example: 100 hours at 120 EUR/h with 2% bonus rate = 240 EUR bonus.

## License

Private project. All rights reserved.
