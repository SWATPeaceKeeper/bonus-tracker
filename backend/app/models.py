"""SQLAlchemy ORM models for the bonus tracker."""

from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    """Tracks a Clockify project with bonus configuration."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    client: Mapped[str] = mapped_column(String(255))
    deal_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    budget_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    hourly_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    bonus_rate: Mapped[float] = mapped_column(Float, default=0.02)
    status: Mapped[str] = mapped_column(String(20), default="aktiv")
    onsite_hourly_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    project_manager: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    time_entries: Mapped[list["TimeEntry"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    report_notes: Mapped[list["CustomerReportNote"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ImportBatch(Base):
    """Records a CSV import operation."""

    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    imported_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    row_count: Mapped[int] = mapped_column(Integer, default=0)

    time_entries: Mapped[list["TimeEntry"]] = relationship(
        back_populates="import_batch"
    )


class TimeEntry(Base):
    """A single time tracking entry from Clockify."""

    __tablename__ = "time_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), index=True
    )
    date: Mapped[date] = mapped_column(Date)
    duration_decimal: Mapped[float] = mapped_column(Float)
    employee: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    month: Mapped[str] = mapped_column(String(7), index=True)
    is_onsite: Mapped[bool] = mapped_column(Boolean, default=False)
    import_batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("import_batches.id"), index=True
    )

    project: Mapped["Project"] = relationship(back_populates="time_entries")
    import_batch: Mapped["ImportBatch"] = relationship(
        back_populates="time_entries"
    )


class CustomerReportNote(Base):
    """Stores per-project, per-month notes for customer reports."""

    __tablename__ = "customer_report_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), index=True
    )
    month: Mapped[str] = mapped_column(String(7))
    note: Mapped[str] = mapped_column(Text, default="")

    project: Mapped["Project"] = relationship(back_populates="report_notes")
