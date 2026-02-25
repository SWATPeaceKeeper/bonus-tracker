"""Parse Clockify detailed CSV exports into structured data."""

import csv
import io
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ParsedTimeEntry:
    """A single parsed time entry from a Clockify CSV row."""

    project_id: str
    project_name: str
    client: str
    employee: str
    description: str
    date: datetime
    start_time: datetime | None
    end_time: datetime | None
    duration_decimal: float
    month: str


@dataclass
class ParsedProject:
    """A discovered project from the CSV data."""

    project_id: str
    name: str
    client: str


@dataclass
class ParseResult:
    """Complete result of parsing a Clockify CSV file."""

    entries: list[ParsedTimeEntry] = field(default_factory=list)
    projects: list[ParsedProject] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def extract_project_id(project_name: str) -> str:
    """Extract the numeric project ID from a Clockify project name.

    Args:
        project_name: Full project name like
            "Thees - Azure Migration Advisory & Implement - 430980254956"

    Returns:
        The last segment after " - ", e.g. "430980254956".
    """
    parts = project_name.split(" - ")
    return parts[-1].strip() if parts else project_name.strip()


def _parse_date(date_str: str) -> datetime:
    """Parse DD/MM/YYYY date string."""
    return datetime.strptime(date_str.strip(), "%d/%m/%Y")


def _parse_time(time_str: str) -> datetime | None:
    """Parse HH:MM time string, returning None if empty."""
    time_str = time_str.strip()
    if not time_str:
        return None
    return datetime.strptime(time_str, "%H:%M")


def parse_csv(content: str) -> ParseResult:
    """Parse a Clockify detailed CSV export.

    Args:
        content: Raw CSV file content as string.

    Returns:
        ParseResult with entries, discovered projects, and any errors.
    """
    result = ParseResult()
    seen_projects: dict[str, ParsedProject] = {}

    reader = csv.DictReader(io.StringIO(content))
    for row_num, row in enumerate(reader, start=2):
        try:
            entry = _parse_row(row, row_num, result.errors)
            if entry is None:
                continue
            result.entries.append(entry)
            if entry.project_id not in seen_projects:
                seen_projects[entry.project_id] = ParsedProject(
                    project_id=entry.project_id,
                    name=entry.project_name,
                    client=entry.client,
                )
        except (ValueError, KeyError, AttributeError) as exc:
            result.errors.append(f"Row {row_num}: unexpected error: {exc}")

    result.projects = list(seen_projects.values())
    return result


def _parse_row(
    row: dict[str, str],
    row_num: int,
    errors: list[str],
) -> ParsedTimeEntry | None:
    """Parse a single CSV row into a ParsedTimeEntry."""
    project_full = row.get("Project", "").strip()
    if not project_full:
        errors.append(f"Row {row_num}: missing Project column")
        return None

    duration_str = row.get("Duration (decimal)", "0").strip()
    try:
        duration = float(duration_str)
    except ValueError:
        errors.append(f"Row {row_num}: invalid duration '{duration_str}'")
        return None

    date_str = row.get("Start Date", "").strip()
    if not date_str:
        errors.append(f"Row {row_num}: missing Start Date")
        return None

    entry_date = _parse_date(date_str)
    project_id = extract_project_id(project_full)
    # Build readable name: everything except the ID suffix
    name_parts = project_full.split(" - ")
    project_name = " - ".join(name_parts[:-1]).strip() if len(name_parts) > 1 else project_full

    start_t = _parse_time(row.get("Start Time", ""))
    end_t = _parse_time(row.get("End Time", ""))

    return ParsedTimeEntry(
        project_id=project_id,
        project_name=project_name,
        client=row.get("Client", "").strip(),
        employee=row.get("User", "").strip(),
        description=row.get("Description", "").strip(),
        date=entry_date,
        start_time=start_t,
        end_time=end_t,
        duration_decimal=duration,
        month=entry_date.strftime("%Y-%m"),
    )
