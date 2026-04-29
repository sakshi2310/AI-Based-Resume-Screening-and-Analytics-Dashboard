from motor.motor_asyncio import AsyncIOMotorCollection

from db.mongodb import get_database


def get_jobs_collection() -> AsyncIOMotorCollection:
    return get_database()["jobs"]


def get_resumes_collection() -> AsyncIOMotorCollection:
    return get_database()["resumes"]


def get_screenings_collection() -> AsyncIOMotorCollection:
    return get_database()["screenings"]


def get_evaluation_runs_collection() -> AsyncIOMotorCollection:
    return get_database()["evaluation_runs"]
