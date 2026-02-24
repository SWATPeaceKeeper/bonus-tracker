"""Tests for the Clockify CSV parser."""

from app.services.csv_parser import extract_project_id, parse_csv

SAMPLE_CSV = """\
"Project","Client","Description","Task","User","Group","Email","Tags","Type","Billable","Invoiced","Invoice ID","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Date of creation","Deal ID"
"Thees - Azure Migration Advisory & Implement - 430980254956","Thees","","","Montserrat Graell","Consultants","montserrat.graell@pexon-consulting.de","","Regular","Yes","No","","19/02/2026","15:00","19/02/2026","18:00","3:00","3.00","24/02/2026",""
"Acme - Cloud Setup - 123456","Acme Corp","Setup work","","John Doe","Engineers","john@example.com","","Regular","Yes","No","","20/02/2026","09:00","20/02/2026","12:30","3:30","3.50","24/02/2026",""
"""

EMPTY_PROJECT_CSV = """\
"Project","Client","Description","Task","User","Group","Email","Tags","Type","Billable","Invoiced","Invoice ID","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Date of creation","Deal ID"
"","Thees","","","Montserrat Graell","Consultants","montserrat.graell@pexon-consulting.de","","Regular","Yes","No","","19/02/2026","15:00","19/02/2026","18:00","3:00","3.00","24/02/2026",""
"""


class TestExtractProjectId:
    """Tests for project ID extraction from Clockify project names."""

    def test_standard_format(self):
        name = "Thees - Azure Migration Advisory & Implement - 430980254956"
        assert extract_project_id(name) == "430980254956"

    def test_two_parts(self):
        assert extract_project_id("Acme - 123456") == "123456"

    def test_single_part(self):
        assert extract_project_id("JustAnId") == "JustAnId"

    def test_multiple_dashes(self):
        name = "A - B - C - 999"
        assert extract_project_id(name) == "999"

    def test_whitespace_handling(self):
        name = "Thees - Azure  -  430980254956 "
        assert extract_project_id(name) == "430980254956"


class TestParseCsv:
    """Tests for full CSV parsing."""

    def test_parse_valid_csv(self):
        result = parse_csv(SAMPLE_CSV)
        assert len(result.entries) == 2
        assert len(result.projects) == 2
        assert len(result.errors) == 0

    def test_first_entry_fields(self):
        result = parse_csv(SAMPLE_CSV)
        entry = result.entries[0]
        assert entry.project_id == "430980254956"
        assert entry.project_name == "Thees - Azure Migration Advisory & Implement"
        assert entry.client == "Thees"
        assert entry.employee == "Montserrat Graell"
        assert entry.duration_decimal == 3.0
        assert entry.month == "2026-02"
        assert entry.date.day == 19
        assert entry.date.month == 2

    def test_second_entry_fields(self):
        result = parse_csv(SAMPLE_CSV)
        entry = result.entries[1]
        assert entry.project_id == "123456"
        assert entry.client == "Acme Corp"
        assert entry.employee == "John Doe"
        assert entry.duration_decimal == 3.5

    def test_discovered_projects(self):
        result = parse_csv(SAMPLE_CSV)
        ids = {p.project_id for p in result.projects}
        assert ids == {"430980254956", "123456"}

    def test_empty_project_creates_error(self):
        result = parse_csv(EMPTY_PROJECT_CSV)
        assert len(result.entries) == 0
        assert len(result.errors) == 1
        assert "missing Project" in result.errors[0]

    def test_empty_csv(self):
        result = parse_csv("")
        assert len(result.entries) == 0
        assert len(result.projects) == 0

    def test_time_parsing(self):
        result = parse_csv(SAMPLE_CSV)
        entry = result.entries[0]
        assert entry.start_time is not None
        assert entry.start_time.hour == 15
        assert entry.start_time.minute == 0
        assert entry.end_time is not None
        assert entry.end_time.hour == 18
