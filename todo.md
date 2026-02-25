# Bonus Tracker — TODO

Remaining improvements identified during code review (2026-02-25).

## Backend

- [x] Add Pydantic validators for non-negative financial fields (hourly_rate, deal_value, budget_hours, bonus_rate)
- [x] Add unique constraint on CustomerReportNote (project_id, month)
- [x] Centralize hardcoded "aktiv" status string into a constant
- [x] Validate export format parameter (reject unknown formats with 400)
- [x] Handle UnicodeDecodeError on CSV import (return 400 instead of 500)
- [x] Narrow broad exception handling in csv_parser.py (catch specific exceptions)
- [x] Add pagination to time_entries endpoint (limit/offset)
- [x] Use timezone-aware datetime in reports (datetime.now(timezone.utc))
- [x] Add transactional guarantees (savepoint) for CSV import
- [x] Add response_model schema for project detail report endpoint
- [x] Add missing type hints on import helper functions

## Frontend

- [x] Add React ErrorBoundary wrapper in App.tsx
- [x] Improve error messages (extract ApiRequestError.detail)
- [x] Add AbortController to useApi hook for cleanup
- [x] Add file size validation on CSV upload
- [x] Add ARIA attributes to DataTable (aria-sort, keyboard nav)
- [x] Add htmlFor/id association on form labels in Projects dialog
- [x] Add request timeout to API client

## Infrastructure

- [x] Pin uv image digest in backend Dockerfile
- [x] Add USER nginx to frontend Dockerfile (non-root)
- [x] Pin nginx image digest in frontend Dockerfile
- [x] Add health checks to docker-compose.yml and docker-compose.prod.yml
- [x] Fix CORS_ORIGINS=[] in docker-compose.yml (should be ["http://localhost:5173"])
- [x] Add resource limits and logging config to docker-compose.prod.yml
- [x] Add pre-build validation (lint + test) to CI workflow
- [x] Add Trivy image scanning to CI workflow
- [x] Add comments to .env.example

## Feature Ideas

- [ ] YTD metrics on Dashboard (year-to-date bonus, revenue, avg monthly)
- [ ] Budget warnings/alerts (toast when project >90% budget)
- [ ] Transparent bonus calculation breakdown per project
- [ ] Clockify API integration (auto-sync instead of manual CSV)
- [ ] Excel export (.xlsx) for finance reports
- [ ] Forecast view (projected YTD totals based on current pace)
- [ ] Project comparison/benchmarking page
- [ ] Bulk project actions (status change, export, delete)
