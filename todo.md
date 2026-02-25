# Bonus Tracker — TODO

Remaining improvements identified during code review (2026-02-25).

## Backend

- [ ] Add Pydantic validators for non-negative financial fields (hourly_rate, deal_value, budget_hours, bonus_rate)
- [ ] Add unique constraint on CustomerReportNote (project_id, month)
- [ ] Centralize hardcoded "aktiv" status string into a constant
- [ ] Validate export format parameter (reject unknown formats with 400)
- [ ] Handle UnicodeDecodeError on CSV import (return 400 instead of 500)
- [ ] Narrow broad exception handling in csv_parser.py (catch specific exceptions)
- [ ] Add pagination to time_entries endpoint (limit/offset)
- [ ] Use timezone-aware datetime in reports (datetime.now(timezone.utc))
- [ ] Add transactional guarantees (savepoint) for CSV import
- [ ] Add response_model schema for project detail report endpoint
- [ ] Add missing type hints on import helper functions

## Frontend

- [ ] Add React ErrorBoundary wrapper in App.tsx
- [ ] Improve error messages (extract ApiRequestError.detail)
- [ ] Add AbortController to useApi hook for cleanup
- [ ] Add file size validation on CSV upload
- [ ] Add ARIA attributes to DataTable (aria-sort, keyboard nav)
- [ ] Add htmlFor/id association on form labels in Projects dialog
- [ ] Add request timeout to API client

## Infrastructure

- [ ] Pin uv image digest in backend Dockerfile
- [ ] Add USER nginx to frontend Dockerfile (non-root)
- [ ] Pin nginx image digest in frontend Dockerfile
- [ ] Add health checks to docker-compose.yml and docker-compose.prod.yml
- [ ] Fix CORS_ORIGINS=[] in docker-compose.yml (should be ["http://localhost:5173"])
- [ ] Add resource limits and logging config to docker-compose.prod.yml
- [ ] Add pre-build validation (lint + test) to CI workflow
- [ ] Add Trivy image scanning to CI workflow
- [ ] Add comments to .env.example

## Feature Ideas

- [ ] YTD metrics on Dashboard (year-to-date bonus, revenue, avg monthly)
- [ ] Budget warnings/alerts (toast when project >90% budget)
- [ ] Transparent bonus calculation breakdown per project
- [ ] Clockify API integration (auto-sync instead of manual CSV)
- [ ] Excel export (.xlsx) for finance reports
- [ ] Forecast view (projected YTD totals based on current pace)
- [ ] Project comparison/benchmarking page
- [ ] Bulk project actions (status change, export, delete)
