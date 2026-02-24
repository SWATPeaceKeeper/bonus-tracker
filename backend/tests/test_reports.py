"""Tests for report endpoints."""

import pytest

SAMPLE_CSV = (
    '"Project","Client","Description","Task","User","Group","Email",'
    '"Tags","Type","Billable","Invoiced","Invoice ID","Start Date",'
    '"Start Time","End Date","End Time","Duration (h)",'
    '"Duration (decimal)","Date of creation","Deal ID"\n'
    '"Alpha - Consulting - 111","AlphaCo","","","Anna Schmidt",'
    '"Team","a@test.de","","Regular","Yes","No","",'
    '"19/02/2026","15:00","19/02/2026","18:00","3:00","3.00","24/02/2026",""\n'
    '"Alpha - Consulting - 111","AlphaCo","","","Bob Mueller",'
    '"Team","b@test.de","","Regular","Yes","No","",'
    '"20/02/2026","09:00","20/02/2026","11:00","2:00","2.00","24/02/2026",""\n'
)


@pytest.fixture
async def seeded_data(client):
    """Import CSV and configure project for report tests."""
    await client.post(
        "/api/imports/upload",
        files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
    )
    projects = (await client.get("/api/projects")).json()
    pid = projects[0]["id"]
    await client.put(
        f"/api/projects/{pid}",
        json={"hourly_rate": 100.0, "bonus_rate": 0.05},
    )
    return pid


class TestDashboard:
    """Tests for the dashboard endpoint."""

    async def test_dashboard_returns_stats(self, client, seeded_data):
        resp = await client.get("/api/reports/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active_projects"] == 1

    async def test_dashboard_empty(self, client):
        resp = await client.get("/api/reports/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active_projects"] == 0


class TestFinanceReport:
    """Tests for the finance report endpoint."""

    async def test_finance_report(self, client, seeded_data):
        resp = await client.get("/api/reports/finance?year=2026")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        feb = data[0]
        assert feb["month"] == "2026-02"
        assert feb["total_hours"] == 5.0
        # bonus = 5.0 * 100.0 * 0.05 = 25.0
        assert feb["total_bonus"] == 25.0

    async def test_finance_report_empty_year(self, client, seeded_data):
        resp = await client.get("/api/reports/finance?year=2020")
        assert resp.status_code == 200
        assert resp.json() == []


class TestProjectReport:
    """Tests for the project detail report endpoint."""

    async def test_project_report(self, client, seeded_data):
        resp = await client.get(f"/api/reports/project/{seeded_data}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_hours"] == 5.0
        assert len(data["monthly_breakdown"]) == 1
        assert len(data["employee_breakdown"]) == 2

    async def test_project_report_not_found(self, client):
        resp = await client.get("/api/reports/project/9999")
        assert resp.status_code == 404


class TestCustomerReport:
    """Tests for the customer report endpoint."""

    async def test_customer_report(self, client, seeded_data):
        resp = await client.get(
            f"/api/reports/customer/{seeded_data}?month=2026-02"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_hours"] == 5.0
        assert len(data["employees"]) == 2

    async def test_customer_note_upsert(self, client, seeded_data):
        # Create note
        resp = await client.post(
            f"/api/reports/customer/{seeded_data}/notes?month=2026-02",
            json={"note": "Good progress"},
        )
        assert resp.status_code == 200
        assert resp.json()["note"] == "Good progress"

        # Update note
        resp = await client.post(
            f"/api/reports/customer/{seeded_data}/notes?month=2026-02",
            json={"note": "Updated note"},
        )
        assert resp.status_code == 200
        assert resp.json()["note"] == "Updated note"

        # Verify via customer report
        resp = await client.get(
            f"/api/reports/customer/{seeded_data}?month=2026-02"
        )
        assert resp.json()["note"] == "Updated note"


class TestTimeEntries:
    """Tests for the time entries endpoint."""

    async def test_list_entries(self, client, seeded_data):
        resp = await client.get(
            f"/api/time-entries?project_id={seeded_data}"
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_filter_by_employee(self, client, seeded_data):
        resp = await client.get(
            f"/api/time-entries?project_id={seeded_data}&employee=Anna Schmidt"
        )
        assert resp.status_code == 200
        entries = resp.json()
        assert len(entries) == 1
        assert entries[0]["employee"] == "Anna Schmidt"

    async def test_filter_by_month(self, client, seeded_data):
        resp = await client.get("/api/time-entries?month=2026-02")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_empty_filter(self, client, seeded_data):
        resp = await client.get("/api/time-entries?month=2020-01")
        assert resp.status_code == 200
        assert len(resp.json()) == 0
