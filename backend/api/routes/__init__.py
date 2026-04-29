from fastapi import APIRouter, Depends

from api.deps import require_database_connection
from api.routes import auth, candidates, health, jobs, resumes, screening

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"], dependencies=[Depends(require_database_connection)])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"], dependencies=[Depends(require_database_connection)])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"], dependencies=[Depends(require_database_connection)])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"], dependencies=[Depends(require_database_connection)])
api_router.include_router(screening.router, prefix="/screening", tags=["screening"], dependencies=[Depends(require_database_connection)])
