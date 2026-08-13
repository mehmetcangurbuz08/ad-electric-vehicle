from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Metadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    mode: Literal["demo", "live"]
    generated_at: datetime = Field(alias="generatedAt")
    geography: str
    trend_definition: str = Field(alias="trendDefinition")
    caveats: list[str]


class Summary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_vehicles: int = Field(alias="totalVehicles", ge=0)
    bev_share: float = Field(alias="bevShare", ge=0, le=100)
    charging_sites: int = Field(alias="chargingSites", ge=0)
    public_ports: int = Field(alias="publicPorts", ge=0)
    dc_fast_ports: int = Field(alias="dcFastPorts", ge=0)
    priority_regions: int = Field(alias="priorityRegions", ge=0)


class TrendPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_year: int = Field(alias="modelYear")
    count: int = Field(ge=0)
    avg_range: float | None = Field(alias="avgRange", default=None, ge=0)


class PowertrainPoint(BaseModel):
    type: Literal["BEV", "PHEV", "Other"]
    count: int = Field(ge=0)


class BrandPoint(BaseModel):
    make: str
    count: int = Field(ge=0)


class Region(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    zip_code: str = Field(alias="zipCode", pattern=r"^\d{5}$")
    city: str
    county: str
    latitude: float
    longitude: float
    vehicles: int = Field(ge=0)
    bev_share: float = Field(alias="bevShare", ge=0, le=100)
    avg_range: float | None = Field(alias="avgRange", default=None, ge=0)
    median_income: float | None = Field(alias="medianIncome", default=None, ge=0)
    avg_commute_minutes: float | None = Field(
        alias="avgCommuteMinutes", default=None, ge=0
    )
    multifamily_share: float | None = Field(
        alias="multifamilyShare", default=None, ge=0, le=100
    )
    public_ports: int = Field(alias="publicPorts", ge=0)
    dc_fast_ports: int = Field(alias="dcFastPorts", ge=0)
    cluster: int = Field(ge=0)
    segment: str
    priority_score: float = Field(alias="priorityScore", ge=0, le=100)
    recommendation: str


class Dashboard(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(alias="schemaVersion")
    metadata: Metadata
    summary: Summary
    vehicle_trend: list[TrendPoint] = Field(alias="vehicleTrend")
    powertrain: list[PowertrainPoint]
    brands: list[BrandPoint]
    regions: list[Region]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    data_mode: Literal["demo", "live"]
    generated_at: datetime

