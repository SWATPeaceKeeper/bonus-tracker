"""CRUD endpoints for projects."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, TimeEntry
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate, ProjectWithHours
from app.services.bonus_calculator import calculate_bonus

router = APIRouter(prefix="/api/projects", tags=["projects"])


async def _enrich_project(
    project: Project, db: AsyncSession
) -> ProjectWithHours:
    """Add computed hours and bonus fields to a project."""
    remote_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.project_id == project.id,
            TimeEntry.is_onsite == False,  # noqa: E712
        )
    )
    remote_hours = float(remote_result.scalar_one())

    onsite_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.project_id == project.id,
            TimeEntry.is_onsite == True,  # noqa: E712
        )
    )
    onsite_hours = float(onsite_result.scalar_one())

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
    projects = result.scalars().all()
    return [await _enrich_project(p, db) for p in projects]


@router.post("", response_model=ProjectWithHours, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new project."""
    existing = await db.execute(
        select(Project).where(Project.project_id == data.project_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Project with project_id '{data.project_id}' already exists",
        )
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return await _enrich_project(project, db)


@router.get("/{project_id}", response_model=ProjectWithHours)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a single project by database ID."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _enrich_project(project, db)


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
    return await _enrich_project(project, db)


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
