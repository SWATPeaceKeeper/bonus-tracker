"""PDF generation with WeasyPrint for customer and finance reports."""

import csv
import io
import locale
import re
from html import escape

GERMAN_MONTHS = {
    "01": "Januar",
    "02": "Februar",
    "03": "März",
    "04": "April",
    "05": "Mai",
    "06": "Juni",
    "07": "Juli",
    "08": "August",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Dezember",
}

PDF_CSS = """
@page { size: A4; margin: 10mm 15mm; }
body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 12px;
    color: #222;
}
h1 { font-size: 22px; margin-bottom: 4px; }
h2 { font-size: 16px; margin-top: 20px; color: #444; }
.subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}
th, td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}
th {
    background: #f5f5f5;
    font-weight: bold;
    border-bottom: 2px solid #999;
}
.right { text-align: right; }
.total-row { font-weight: bold; background: #f5f5f5; }
.note { margin-top: 8px; padding: 8px; background: #fafafa;
        border-left: 3px solid #ccc; }
.signatures { margin-top: 60px; }
.sig-table { width: 100%; border: none; }
.sig-table td { border: none; width: 45%; vertical-align: top; padding: 0; }
.sig-table td.spacer { width: 10%; }
.sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 6px; }
.sig-name { font-weight: bold; margin-bottom: 2px; }
.sig-label { font-size: 10px; color: #666; }
"""


def format_number(value: float | None) -> str:
    """Format number with German locale: 1.234,56."""
    if value is None:
        return "—"
    try:
        locale.setlocale(locale.LC_ALL, "de_DE.UTF-8")
        return locale.format_string("%.2f", value, grouping=True)
    except locale.Error:
        # Fallback if locale not available
        formatted = f"{value:,.2f}"
        return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def format_currency(value: float | None) -> str:
    """Format as Euro currency: 1.234,56 EUR."""
    if value is None:
        return "—"
    return f"{format_number(value)} €"


def german_month(month_str: str) -> str:
    """Convert YYYY-MM to German month name + year."""
    parts = month_str.split("-")
    if len(parts) != 2:
        return month_str
    return f"{GERMAN_MONTHS.get(parts[1], parts[1])} {parts[0]}"


def generate_customer_pdf(
    project_name: str,
    client: str,
    month: str,
    monthly_data: list[dict],
    entries_by_month: dict[str, list[dict]],
    notes_by_month: dict[str, str],
    project_manager: str | None = None,
    customer_contact: str | None = None,
) -> bytes:
    """Generate a customer report PDF.

    Args:
        project_name: Display name of the project.
        client: Client name.
        month: Report month in YYYY-MM format.
        monthly_data: List of {month, hours} dicts.
        entries_by_month: Time entries grouped by month key.
        notes_by_month: Notes keyed by month string.
        project_manager: Name of the project manager for signature.
        customer_contact: Name of the customer contact for signature.

    Returns:
        PDF file content as bytes.
    """
    monthly_rows = ""
    total_hours = 0.0
    for m in monthly_data:
        monthly_rows += (
            f"<tr>"
            f"<td>{german_month(m['month'])}</td>"
            f"<td class='right'>{format_number(m['hours'])}</td>"
            f"</tr>"
        )
        total_hours += m["hours"]

    monthly_rows += (
        f"<tr class='total-row'>"
        f"<td>Gesamt</td>"
        f"<td class='right'>{format_number(total_hours)}</td>"
        f"</tr>"
    )

    detail_sections = ""
    for month_key in sorted(entries_by_month.keys()):
        entries = entries_by_month[month_key]
        detail_sections += f"<h2>{german_month(month_key)}</h2>"

        note = notes_by_month.get(month_key, "")
        if note:
            detail_sections += f"<div class='note'>{escape(note)}</div>"

        detail_sections += (
            "<table><tr><th>Datum</th><th>Mitarbeiter</th>"
            "<th>Beschreibung</th>"
            "<th class='right'>Stunden</th></tr>"
        )
        for e in entries:
            detail_sections += (
                f"<tr>"
                f"<td>{e['date']}</td>"
                f"<td>{escape(e['employee'])}</td>"
                f"<td>{escape(e.get('description', ''))}</td>"
                f"<td class='right'>{format_number(e['hours'])}</td>"
                f"</tr>"
            )
        detail_sections += "</table>"

    signatures = """
<table class='sig-table'>
<tr>
<td>
<div class='sig-line'>
<div class='sig-name'>{pm}</div>
<div class='sig-label'>Datum / Unterschrift Projektleiter</div>
</div>
</td>
<td class='spacer'></td>
<td>
<div class='sig-line'>
<div class='sig-name'>{cc}</div>
<div class='sig-label'>Datum / Unterschrift Kunde</div>
</div>
</td>
</tr>
</table>
""".format(
        pm=escape(project_manager or ""),
        cc=escape(customer_contact or ""),
    )

    html = f"""<!DOCTYPE html>
<html><head><style>{PDF_CSS}</style></head><body>
<h1>{escape(project_name)}</h1>
<div class='subtitle'>Kunde: {escape(client)} | {german_month(month)}</div>

<h2>Monatliche Stundenübersicht</h2>
<table>
<tr><th>Monat</th><th class='right'>Stunden</th></tr>
{monthly_rows}
</table>

{detail_sections}

{signatures}
</body></html>"""

    return _render_pdf(html)


def generate_finance_pdf(
    year: int,
    projects_data: list[dict],
    month_str: str | None = None,
) -> bytes:
    """Generate a finance report PDF.

    Args:
        year: Report year.
        projects_data: List of project dicts with monthly breakdowns.
        month_str: Optional month in YYYY-MM format for monthly reports.

    Returns:
        PDF file content as bytes.
    """
    title = (
        f"Finanzübersicht {german_month(month_str)}"
        if month_str
        else f"Finanzübersicht {year}"
    )

    rows = ""
    grand_hours = 0.0
    grand_bonus = 0.0

    for p in projects_data:
        rows += (
            f"<tr>"
            f"<td>{escape(p['project_name'])}</td>"
            f"<td>{escape(p['client'])}</td>"
            f"<td class='right'>{format_currency(p.get('hourly_rate'))}</td>"
            f"<td class='right'>{format_number(p['bonus_rate'] * 100)}%</td>"
            f"<td class='right'>{format_number(p['total_hours'])}</td>"
            f"<td class='right'>{format_currency(p['total_bonus'])}</td>"
            f"</tr>"
        )
        grand_hours += p["total_hours"]
        grand_bonus += p["total_bonus"]

    rows += (
        f"<tr class='total-row'>"
        f"<td colspan='4'>Gesamt</td>"
        f"<td class='right'>{format_number(grand_hours)}</td>"
        f"<td class='right'>{format_currency(grand_bonus)}</td>"
        f"</tr>"
    )

    html = f"""<!DOCTYPE html>
<html><head><style>{PDF_CSS}</style></head><body>
<h1>{title}</h1>
<div class='subtitle'>Pre-Sales Bonus Report</div>

<table>
<tr>
<th>Projekt</th><th>Kunde</th>
<th class='right'>Stundensatz</th>
<th class='right'>Bonussatz</th>
<th class='right'>Stunden</th>
<th class='right'>Bonus</th>
</tr>
{rows}
</table>

</body></html>"""

    return _render_pdf(html)


def generate_finance_csv(
    projects_data: list[dict],
) -> str:
    """Generate a finance report as CSV string.

    Args:
        projects_data: List of project dicts with totals.

    Returns:
        CSV content as string.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow(["Projekt", "Kunde", "Stundensatz",
                     "Bonussatz", "Stunden", "Bonus"])
    for p in projects_data:
        rate = p.get("hourly_rate") or 0
        writer.writerow([
            _defuse_formula(p["project_name"]),
            _defuse_formula(p["client"]),
            rate,
            p["bonus_rate"],
            p["total_hours"],
            p["total_bonus"],
        ])
    return output.getvalue()


def _defuse_formula(value: str) -> str:
    """Prefix characters that trigger formula execution in spreadsheets."""
    if value and value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{value}"
    return value


def safe_filename(name: str) -> str:
    """Remove characters unsafe for HTTP headers and filenames."""
    return re.sub(r"[^\w\-.]", "_", name)


def _render_pdf(html: str) -> bytes:
    """Render HTML string to PDF bytes."""
    from weasyprint import HTML  # Lazy import: requires system pango libs

    buf = io.BytesIO()
    HTML(string=html).write_pdf(buf)
    return buf.getvalue()
