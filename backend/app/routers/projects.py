"""CRUD endpoints for projects."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STATUS_ACTIVE, STATUS_COMPLETED, STATUS_PAUSED
from app.database import get_db
from app.models import Project
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate, ProjectWithHours
from app.services.bonus_calculator import calculate_bonus
from app.services.hours_service import get_hours_by_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


class BulkStatusUpdate(BaseModel):
    """Bulk status update request."""

    project_ids: list[int]
    status: str


def _build_project_with_hours(
    project: Project,
    remote_hours: float,
    onsite_hours: float,
) -> ProjectWithHours:
    """Build ProjectWithHours from a project and its hour totals."""
    total_hours = remote_hours + onsite_hours
    bonus_amount = calculate_bonus(
        remote_hours=remote_hours,
        onsite_hours=onsite_hours,
        hourly_rate=project.hourly_rate,
        onsite_hourly_rate=project.onsite_hourly_rate,
        bonus_rate=project.bonus_rate,
    )
    data = ProjectRead.model_validate(project).model_dump()
    data["total_hours"] = round(total_hours, 2)
    data["bonus_amount"] = bonus_amount
    data["remote_hours"] = round(remote_hours, 2)
    data["onsite_hours"] = round(onsite_hours, 2)
    return ProjectWithHours(**data)


@router.get("", response_model=list[ProjectWithHours])
async def list_projects(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all projects, optionally filtered by status."""
    stmt = select(Project).order_by(Project.name)
    if status:
        stmt = stmt.where(Project.status == status)
    result = await db.execute(stmt)
    projects = list(result.scalars().all())

    hours_map = await get_hours_by_project(db, [p.id for p in projects])
    return [
        _build_project_with_hours(p, *hours_map.get(p.id, (0.0, 0.0)))
        for p in projects
    ]


@router.post("", response_model=ProjectWithHours, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    existing = await db.execute(select(Project).where(Project.project_id == data.project_id))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Project with project_id '{data.project_id}' already exists",
        )
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    hours_map = await get_hours_by_project(db, [project.id])
    return _build_project_with_hours(project, *hours_map.get(project.id, (0.0, 0.0)))


@router.put("/bulk/status")
async def bulk_update_status(
    data: BulkStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update status for multiple projects at once."""
    if data.status not in (STATUS_ACTIVE, STATUS_PAUSED, STATUS_COMPLETED):
        raise HTTPException(status_code=400, detail="Invalid status")

    result = await db.execute(
        select(Project).where(Project.id.in_(data.project_ids))
    )
    projects = result.scalars().all()
    updated = 0
    for project in projects:
        project.status = data.status
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.delete("/bulk")
async def bulk_delete(
    project_ids: list[int] = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple projects at once."""
    result = await db.execute(
        select(Project).where(Project.id.in_(project_ids))
    )
    projects = result.scalars().all()
    deleted = 0
    for project in projects:
        await db.delete(project)
        deleted += 1
    await db.commit()
    return {"deleted": deleted}


@router.get("/{project_id}", response_model=ProjectWithHours)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single project by database ID."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    hours_map = await get_hours_by_project(db, [project.id])
    return _build_project_with_hours(project, *hours_map.get(project.id, (0.0, 0.0)))


@router.put("/{project_id}", response_model=ProjectWithHours)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a project's fields."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    hours_map = await get_hours_by_project(db, [project.id])
    return _build_project_with_hours(project, *hours_map.get(project.id, (0.0, 0.0)))


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a project and all associated time entries."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
