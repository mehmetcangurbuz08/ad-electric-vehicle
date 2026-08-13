from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AliasedModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class Metadata(AliasedModel):
    mode: Literal["demo", "live"]
    generated_at: datetime = Field(alias="generatedAt")
    geography: str
    trend_definition: str = Field(alias="trendDefinition")
    station_definition: str = Field(alias="stationDefinition")
    caveats: list[str]


class Summary(AliasedModel):
    total_vehicles: int = Field(alias="totalVehicles", ge=0)
    bev_share: float = Field(alias="bevShare", ge=0, le=100)
    charging_sites: int = Field(alias="chargingSites", ge=0)
    level2_ports: int = Field(alias="level2Ports", ge=0)
    dc_fast_ports: int = Field(alias="dcFastPorts", ge=0)
    public_ports: int = Field(alias="publicPorts", ge=0)
    ev_per_port: float = Field(alias="evPerPort", ge=0)
    zips_without_charging: int = Field(alias="zipsWithoutCharging", ge=0)
    below_average_charging_zips: int = Field(alias="belowAverageChargingZips", ge=0)
    census_matched_zips: int = Field(alias="censusMatchedZips", ge=0)
    known_range_share: float = Field(alias="knownRangeShare", ge=0, le=100)


class TrendPoint(AliasedModel):
    model_year: int = Field(alias="modelYear")
    count: int = Field(ge=0)
    avg_range: float | None = Field(alias="avgRange", default=None, ge=0)


class PowertrainPoint(BaseModel):
    type: Literal["BEV", "PHEV", "Other"]
    count: int = Field(ge=0)


class BrandPoint(BaseModel):
    make: str
    count: int = Field(ge=0)


class ModelPoint(BaseModel):
    model: str
    count: int = Field(ge=0)


class RangeBandPoint(BaseModel):
    band: str
    count: int = Field(ge=0)


class RangePowertrainPoint(AliasedModel):
    type: Literal["BEV", "PHEV"]
    known_count: int = Field(alias="knownCount", ge=0)
    known_share: float = Field(alias="knownShare", ge=0, le=100)
    median_range: float = Field(alias="medianRange", ge=0)
    average_range: float = Field(alias="averageRange", ge=0)


class RangeBrandPoint(AliasedModel):
    make: str
    known_count: int = Field(alias="knownCount", ge=0)
    known_share: float = Field(alias="knownShare", ge=0, le=100)
    median_range: float = Field(alias="medianRange", ge=0)


class SourcePoint(BaseModel):
    name: str
    period: str
    usage: str
    url: str


class ChargingMixPoint(BaseModel):
    type: Literal["Level 2", "DC Fast"]
    count: int = Field(ge=0)


class NetworkPoint(BaseModel):
    network: str
    sites: int = Field(ge=0)
    ports: int = Field(ge=0)


class CountyPoint(AliasedModel):
    county: str
    vehicles: int = Field(ge=0)
    charging_sites: int = Field(alias="chargingSites", ge=0)
    public_ports: int = Field(alias="publicPorts", ge=0)
    dc_fast_ports: int = Field(alias="dcFastPorts", ge=0)
    ev_per_port: float | None = Field(alias="evPerPort", default=None, ge=0)
    median_income: float | None = Field(alias="medianIncome", default=None, ge=0)
    ev_per_1k_housing: float | None = Field(alias="evPer1kHousing", default=None, ge=0)


class CorrelationPoint(AliasedModel):
    left: str
    right: str
    value: float = Field(ge=-1, le=1)
    sample_size: int = Field(alias="sampleSize", ge=2)


class IncomeGroupPoint(AliasedModel):
    group: str
    zip_count: int = Field(alias="zipCount", ge=1)
    median_income: float = Field(alias="medianIncome", ge=0)
    median_ev_per_1k_housing: float = Field(alias="medianEvPer1kHousing", ge=0)


class IncomeScatterPoint(AliasedModel):
    zip_code: str = Field(alias="zipCode", pattern=r"^\d{5}$")
    city: str
    median_income: float = Field(alias="medianIncome", ge=0)
    ev_per_1k_housing: float = Field(alias="evPer1kHousing", ge=0)


class DataQuality(AliasedModel):
    total_rows: int = Field(alias="totalRows", ge=0)
    known_range_rows: int = Field(alias="knownRangeRows", ge=0)
    known_range_share: float = Field(alias="knownRangeShare", ge=0, le=100)
    median_known_range: float = Field(alias="medianKnownRange", ge=0)
    missing_location_rows: int = Field(alias="missingLocationRows", ge=0)
    zip_count: int = Field(alias="zipCount", ge=0)
    city_count: int = Field(alias="cityCount", ge=0)
    county_count: int = Field(alias="countyCount", ge=0)
    active_public_sites: int = Field(alias="activePublicSites", ge=0)
    station_zip_count: int = Field(alias="stationZipCount", ge=0)
    missing_zip_rows: int = Field(alias="missingZipRows", ge=0)
    missing_coordinate_rows: int = Field(alias="missingCoordinateRows", ge=0)
    latest_station_update: datetime = Field(alias="latestStationUpdate")
    census_matched_zips: int = Field(alias="censusMatchedZips", ge=0)
    complete_census_zips: int = Field(alias="completeCensusZips", ge=0)


class Region(AliasedModel):
    zip_code: str = Field(alias="zipCode", pattern=r"^\d{5}$")
    city: str
    county: str
    latitude: float
    longitude: float
    vehicles: int = Field(ge=0)
    bev_vehicles: int = Field(alias="bevVehicles", ge=0)
    phev_vehicles: int = Field(alias="phevVehicles", ge=0)
    bev_share: float = Field(alias="bevShare", ge=0, le=100)
    avg_range: float | None = Field(alias="avgRange", default=None, ge=0)
    known_range_share: float = Field(alias="knownRangeShare", ge=0, le=100)
    charging_sites: int = Field(alias="chargingSites", ge=0)
    level2_ports: int = Field(alias="level2Ports", ge=0)
    public_ports: int = Field(alias="publicPorts", ge=0)
    dc_fast_ports: int = Field(alias="dcFastPorts", ge=0)
    ports_per_1k_vehicles: float = Field(alias="portsPer1kVehicles", ge=0)
    ev_per_port: float | None = Field(alias="evPerPort", default=None, ge=0)
    coverage_status: str = Field(alias="coverageStatus")
    coverage_note: str = Field(alias="coverageNote")
    median_income: float | None = Field(alias="medianIncome", default=None, ge=0)
    housing_units: int | None = Field(alias="housingUnits", default=None, ge=0)
    multifamily_share: float | None = Field(alias="multifamilyShare", default=None, ge=0, le=100)
    work_from_home_share: float | None = Field(alias="workFromHomeShare", default=None, ge=0, le=100)
    long_commute_share: float | None = Field(alias="longCommuteShare", default=None, ge=0, le=100)
    avg_commute_minutes: float | None = Field(alias="avgCommuteMinutes", default=None, ge=0)
    ev_per_1k_housing: float | None = Field(alias="evPer1kHousing", default=None, ge=0)


class Dashboard(AliasedModel):
    schema_version: str = Field(alias="schemaVersion")
    metadata: Metadata
    summary: Summary
    vehicle_trend: list[TrendPoint] = Field(alias="vehicleTrend")
    powertrain: list[PowertrainPoint]
    brands: list[BrandPoint]
    models: list[ModelPoint]
    range_bands: list[RangeBandPoint] = Field(alias="rangeBands")
    range_by_powertrain: list[RangePowertrainPoint] = Field(alias="rangeByPowertrain")
    range_by_brand: list[RangeBrandPoint] = Field(alias="rangeByBrand")
    charging_mix: list[ChargingMixPoint] = Field(alias="chargingMix")
    networks: list[NetworkPoint]
    counties: list[CountyPoint]
    correlations: list[CorrelationPoint]
    income_groups: list[IncomeGroupPoint] = Field(alias="incomeGroups")
    income_scatter: list[IncomeScatterPoint] = Field(alias="incomeScatter")
    data_quality: DataQuality = Field(alias="dataQuality")
    sources: list[SourcePoint]
    regions: list[Region]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    data_mode: Literal["demo", "live"]
    generated_at: datetime
