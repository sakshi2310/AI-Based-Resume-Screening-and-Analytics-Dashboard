from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class JobBase(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    department: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=120)
    employment_type: str = Field(min_length=2, max_length=60)
    work_mode: str = Field(min_length=2, max_length=60)
    experience_level: str = Field(min_length=2, max_length=60)
    min_experience_years: int = Field(ge=0, le=50)
    max_experience_years: int | None = Field(default=None, ge=0, le=50)
    openings: int = Field(default=1, ge=1, le=1000)
    salary_range: str | None = Field(default=None, max_length=120)
    description: str = Field(min_length=20, max_length=5000)
    responsibilities: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    is_active: bool = True


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    department: str | None = Field(default=None, min_length=2, max_length=100)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    employment_type: str | None = Field(default=None, min_length=2, max_length=60)
    work_mode: str | None = Field(default=None, min_length=2, max_length=60)
    experience_level: str | None = Field(default=None, min_length=2, max_length=60)
    min_experience_years: int | None = Field(default=None, ge=0, le=50)
    max_experience_years: int | None = Field(default=None, ge=0, le=50)
    openings: int | None = Field(default=None, ge=1, le=1000)
    salary_range: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, min_length=20, max_length=5000)
    responsibilities: list[str] | None = None
    requirements: list[str] | None = None
    skills: list[str] | None = None
    qualifications: list[str] | None = None
    benefits: list[str] | None = None
    is_active: bool | None = None


class JobStatusUpdate(BaseModel):
    is_active: bool


class JobPublic(JobBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
