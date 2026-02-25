"""Data source abstraction for time entry imports.

Defines a common protocol that both CSV parsing and future API integrations
(e.g. Clockify REST API) can implement. The import router works against this
protocol, making the source interchangeable.

To add Clockify API support later:
  1. Create ``clockify_client.py`` implementing ``TimeEntrySource``
  2. Add API key management (settings + encrypted storage)
  3. Register the new source in the import router
"""

from typing import Protocol

from app.services.csv_parser import ParseResult


class TimeEntrySource(Protocol):
    """Protocol for time entry data sources.

    Implementations must provide a ``fetch`` method that returns
    a ``ParseResult`` with entries, discovered projects, and errors.
    """

    async def fetch(self) -> ParseResult:
        """Fetch time entries from the source.

        Returns:
            ParseResult with entries, projects, and any errors.
        """
        ...


class CsvSource:
    """CSV file data source — wraps the existing parser."""

    def __init__(self, content: str) -> None:
        self._content = content

    async def fetch(self) -> ParseResult:
        """Parse CSV content and return structured data."""
        from app.services.csv_parser import parse_csv

        return parse_csv(self._content)
