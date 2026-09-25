from datetime import date
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Task(BaseModel):
    """
    A single unit of work in the Plan phase.
    """
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    estimate_days: int = Field(default=1, ge=1, le=180)
    dependencies: list[UUID] = Field(default_factory=list)
    owner_id: UUID | None = None
    status: str = Field(default="not_started")
    must_have: bool = False


class TaskWithTimeline(Task):
    """
    A task enriched with timeline info computed server-side.
    """
    latest_start_date: date | None = None
    earliest_start_day: int | None = None
    critical_path_index: int | None = None


class TaskGraph(BaseModel):
    """
    The full Plan artifact. Stored in Artifact.data with kind="task_graph".
    """
    tasks: list[Task] = Field(default_factory=list)
    deadline: date | None = None
    budget_days: int | None = None


class TaskGraphEnriched(BaseModel):
    """
    Response shape for GET /plan — includes computed timeline.
    """
    tasks: list[TaskWithTimeline]
    deadline: date | None
    budget_days: int | None


class TaskCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    estimate_days: int = Field(default=1, ge=1, le=180)
    owner_id: UUID | None = None
    must_have: bool = False


class TaskUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    estimate_days: int | None = Field(None, ge=1, le=180)
    owner_id: UUID | None = None
    status: str | None = None
    must_have: bool | None = None


class DependencyCreate(BaseModel):
    from_task_id: UUID
    to_task_id: UUID


class CriticalPathResponse(BaseModel):
    path_task_ids: list[UUID]
    total_days: int
    has_cycle: bool


class PlanMetaUpdate(BaseModel):
    deadline: date | None = None
    budget_days: int | None = Field(None, ge=1, le=3650)


class PlanScheduleSummary(BaseModel):
    """Project-level schedule information for the diagram view."""
    total_duration_days: int
    critical_path_task_ids: list[UUID]
    has_cycle: bool
    parallelizable_task_ids: list[UUID]
    terminal_task_ids: list[UUID]


class TaskGraphDetailed(BaseModel):
    """The full plan response with schedule summary."""
    tasks: list[TaskWithTimeline]
    deadline: date | None
    budget_days: int | None
    schedule: PlanScheduleSummary
