from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.models import Dashboard, HealthResponse, Region
from backend.app.repository import DashboardRepository


repository = DashboardRepository(settings.data_path)
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Washington EV demand and charging infrastructure analytics.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_dashboard() -> Dashboard:
    try:
        return repository.load()
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get(f"{settings.api_prefix}/health", response_model=HealthResponse)
def health() -> HealthResponse:
    dashboard = get_dashboard()
    return HealthResponse(
        status="ok",
        data_mode=dashboard.metadata.mode,
        generated_at=dashboard.metadata.generated_at,
    )


@app.get(f"{settings.api_prefix}/dashboard", response_model=Dashboard)
def dashboard() -> Dashboard:
    return get_dashboard()


@app.get(f"{settings.api_prefix}/regions", response_model=list[Region])
def regions(
    minimum_priority: float = Query(default=0, ge=0, le=100),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Region]:
    items = (
        region
        for region in get_dashboard().regions
        if region.priority_score >= minimum_priority
    )
    return sorted(items, key=lambda item: item.priority_score, reverse=True)[:limit]

