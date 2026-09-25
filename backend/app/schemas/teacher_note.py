from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

LinkKind = Literal["video", "article", "tool", "docs", "example"]


class NoteLink(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=4, max_length=2000)
    kind: LinkKind = "article"


class TeacherNoteCreate(BaseModel):
    phase: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=3, max_length=255)
    body: str = Field(..., min_length=10, max_length=20000)
    links: list[NoteLink] = Field(default_factory=list, max_length=20)
    is_published: bool = True


class TeacherNoteUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=255)
    body: str | None = Field(None, min_length=10, max_length=20000)
    links: list[NoteLink] | None = None
    is_published: bool | None = None


class TeacherNoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: UUID
    tenant_id: UUID
    phase: str
    author_id: UUID | None
    title: str
    body: str
    links: list[NoteLink]
    is_published: bool
    created_at: datetime
    updated_at: datetime
