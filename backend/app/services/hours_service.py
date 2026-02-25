"""Batch queries for time entry hours, avoiding N+1 query patterns."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import ColumnElement

from app.models import TimeEntry


async def get_hours_by_project(
    db: AsyncSession,
    project_ids: list[int],
    *filters: ColumnElement[bool],
) -> dict[int, tuple[float, float]]:
    """Return {project_id: (remote_hours, onsite_hours)} in one query.

    Args:
        db: Database session.
        project_ids: Project IDs to aggregate.
        *filters: Additional WHERE conditions (e.g. month filter).

    Returns:
        Dict mapping project_id to (remote_hours, onsite_hours).
    """
    if not project_ids:
        return {}

    stmt = (
        select(
            TimeEntry.project_id,
            TimeEntry.is_onsite,
            func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0),
        )
        .where(TimeEntry.project_id.in_(project_ids))
        .group_by(TimeEntry.project_id, TimeEntry.is_onsite)
    )
    for f in filters:
        stmt = stmt.where(f)

    result = await db.execute(stmt)

    hours: dict[int, tuple[float, float]] = {pid: (0.0, 0.0) for pid in project_ids}
    for pid, is_onsite, total in result.all():
        remote, onsite = hours[pid]
        if is_onsite:
            hours[pid] = (remote, float(total))
        else:
            hours[pid] = (float(total), onsite)
    return hours


async def get_hours_by_month(
    db: AsyncSession,
    project_id: int,
) -> dict[str, tuple[float, float]]:
    """Return {month: (remote_hours, onsite_hours)} for a single project.

    Uses one query with GROUP BY month, is_onsite instead of 2 queries per month.
    """
    stmt = (
        select(
            TimeEntry.month,
            TimeEntry.is_onsite,
            func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0),
        )
        .where(TimeEntry.project_id == project_id)
        .group_by(TimeEntry.month, TimeEntry.is_onsite)
        .order_by(TimeEntry.month)
    )

    result = await db.execute(stmt)

    hours: dict[str, tuple[float, float]] = {}
    for month, is_onsite, total in result.all():
        remote, onsite = hours.get(month, (0.0, 0.0))
        if is_onsite:
            hours[month] = (remote, float(total))
        else:
            hours[month] = (float(total), onsite)
    return hours
