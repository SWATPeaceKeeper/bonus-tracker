"""Integration tests for API endpoints."""

import pytest

SAMPLE_CSV = (
    '"Project","Client","Description","Task","User","Group","Email",'
    '"Tags","Type","Billable","Invoiced","Invoice ID","Start Date",'
    '"Start Time","End Date","End Time","Duration (h)",'
    '"Duration (decimal)","Date of creation","Deal ID"\n'
    '"Thees - Azure Migration - 430980254956","Thees","","","Montserrat Graell",'
    '"Consultants","m@test.de","","Regular","Yes","No","",'
    '"19/02/2026","15:00","19/02/2026","18:00","3:00","3.00","24/02/2026",""\n'
    '"Thees - Azure Migration - 430980254956","Thees","","","Montserrat Graell",'
    '"Consultants","m@test.de","","Regular","Yes","No","",'
    '"20/02/2026","09:00","20/02/2026","12:00","3:00","3.00","24/02/2026",""\n'
)


class TestProjectsCrud:
    """Test project CRUD endpoints."""

    @pytest.fixture
    async def project(self, client):
        """Create a project for tests."""
        resp = await client.post(
            "/api/projects",
            json={
                "name": "Test Project",
                "client": "Test Client",
                "project_id": "12345",
                "hourly_rate": 150.0,
                "bonus_rate": 0.02,
            },
        )
        assert resp.status_code == 201
        return resp.json()

    async def test_create_project(self, client):
        resp = await client.post(
            "/api/projects",
            json={
                "name": "New Project",
                "client": "Client A",
                "project_id": "99999",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["project_id"] == "99999"
        assert data["status"] == "aktiv"
        assert data["bonus_rate"] == 0.02

    async def test_create_duplicate_project(self, client, project):
        resp = await client.post(
            "/api/projects",
            json={
                "name": "Dup",
                "client": "Client",
                "project_id": "12345",
            },
        )
        assert resp.status_code == 409

    async def test_list_projects(self, client, project):
        resp = await client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Project"

    async def test_list_projects_filter_status(self, client, project):
        resp = await client.get("/api/projects?status=pausiert")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_get_project(self, client, project):
        resp = await client.get(f"/api/projects/{project['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Project"

    async def test_get_project_not_found(self, client):
        resp = await client.get("/api/projects/9999")
        assert resp.status_code == 404

    async def test_update_project(self, client, project):
        resp = await client.put(
            f"/api/projects/{project['id']}",
            json={"hourly_rate": 200.0, "status": "pausiert"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["hourly_rate"] == 200.0
        assert data["status"] == "pausiert"

    async def test_delete_project(self, client, project):
        resp = await client.delete(f"/api/projects/{project['id']}")
        assert resp.status_code == 204
        resp = await client.get(f"/api/projects/{project['id']}")
        assert resp.status_code == 404


class TestImportEndpoints:
    """Test CSV import endpoints."""

    async def test_upload_csv(self, client):
        resp = await client.post(
            "/api/imports/upload",
            files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows_imported"] == 2
        assert data["projects_created"] == 1

    async def test_upload_csv_dedup(self, client):
        # First import
        await client.post(
            "/api/imports/upload",
            files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
        )
        # Second import of same data
        resp = await client.post(
            "/api/imports/upload",
            files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
        )
        data = resp.json()
        assert data["rows_imported"] == 0
        assert data["projects_created"] == 0

    async def test_upload_non_csv(self, client):
        resp = await client.post(
            "/api/imports/upload",
            files={"file": ("test.txt", b"not csv", "text/plain")},
        )
        assert resp.status_code == 400

    async def test_list_imports(self, client):
        await client.post(
            "/api/imports/upload",
            files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
        )
        resp = await client.get("/api/imports")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_bonus_calculation_after_import(self, client):
        """Verify bonus is computed correctly after importing time entries."""
        # Import entries (auto-creates project)
        await client.post(
            "/api/imports/upload",
            files={"file": ("test.csv", SAMPLE_CSV.encode(), "text/csv")},
        )
        # Update project with hourly rate
        projects = (await client.get("/api/projects")).json()
        pid = projects[0]["id"]
        await client.put(
            f"/api/projects/{pid}",
            json={"hourly_rate": 150.0, "bonus_rate": 0.02},
        )
        # Verify computed fields
        resp = await client.get(f"/api/projects/{pid}")
        data = resp.json()
        assert data["total_hours"] == 6.0
        # bonus = 6.0 * 150.0 * 0.02 = 18.0
        assert data["bonus_amount"] == 18.0
