"""CSV import endpoints."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ImportBatch, Project, TimeEntry
from app.schemas import ImportBatchRead, ImportResult
from app.services.csv_parser import parse_csv

router = APIRouter(prefix="/api/imports", tags=["imports"])


@router.post("/upload", response_model=ImportResult)
async def upload_csv(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    """Import time entries from a Clockify detailed CSV export.

    Auto-creates projects that don't exist. Skips duplicate entries
    (same employee + date + duration + project).
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = (await file.read()).decode("utf-8-sig")
    result = parse_csv(content)

    if not result.entries:
        raise HTTPException(
            status_code=400,
            detail=f"No valid entries found. Errors: {result.errors}",
        )

    projects_created = await _ensure_projects(result.projects, db)
    project_map = await _build_project_map(db)

    batch = ImportBatch(filename=file.filename, row_count=0)
    db.add(batch)
    await db.flush()

    imported = 0
    for entry in result.entries:
        db_project_id = project_map.get(entry.project_id)
        if db_project_id is None:
            continue

        is_dup = await _is_duplicate(
            db,
            db_project_id,
            entry.employee,
            entry.date,
            entry.duration_decimal,
        )
        if is_dup:
            continue

        time_entry = TimeEntry(
            project_id=db_project_id,
            date=entry.date.date(),
            duration_decimal=entry.duration_decimal,
            employee=entry.employee,
            description=entry.description,
            start_time=entry.start_time.time() if entry.start_time else None,
            end_time=entry.end_time.time() if entry.end_time else None,
            month=entry.month,
            import_batch_id=batch.id,
        )
        db.add(time_entry)
        imported += 1

    batch.row_count = imported
    await db.commit()

    return ImportResult(
        batch_id=batch.id,
        rows_imported=imported,
        projects_created=projects_created,
        projects_updated=0,
    )


@router.get("", response_model=list[ImportBatchRead])
async def list_imports(db: AsyncSession = Depends(get_db)):
    """List all import batches, newest first."""
    result = await db.execute(select(ImportBatch).order_by(ImportBatch.imported_at.desc()))
    return result.scalars().all()


async def _ensure_projects(projects, db: AsyncSession) -> int:
    """Create projects that don't exist yet. Return count of newly created."""
    created = 0
    for p in projects:
        existing = await db.execute(select(Project).where(Project.project_id == p.project_id))
        if existing.scalar_one_or_none():
            continue
        project = Project(
            project_id=p.project_id,
            name=p.name,
            client=p.client,
            bonus_rate=0.02,
        )
        db.add(project)
        created += 1
    await db.flush()
    return created


async def _build_project_map(db: AsyncSession) -> dict[str, int]:
    """Build mapping from Clockify project_id to database id."""
    result = await db.execute(select(Project.project_id, Project.id))
    return {row[0]: row[1] for row in result.all()}


async def _is_duplicate(
    db: AsyncSession,
    project_id: int,
    employee: str,
    entry_date,
    duration: float,
) -> bool:
    """Check if a matching time entry already exists."""
    result = await db.execute(
        select(TimeEntry.id)
        .where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.employee == employee,
                TimeEntry.date == entry_date.date(),
                TimeEntry.duration_decimal == duration,
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None
