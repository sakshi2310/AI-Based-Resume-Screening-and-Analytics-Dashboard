from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

AppRole = Literal["admin", "recruiter", "viewer"]


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=100)
    role: AppRole = "recruiter"
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserPublic(UserBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
