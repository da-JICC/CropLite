"""Small TerraAI Copernicus API backend. Run `uvicorn app:app --reload --port 8000`."""
from __future__ import annotations

import os
import asyncio
from datetime import date
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from copernicus import CopernicusClient, CopernicusError
from nasa_power_service import PowerClient, PowerError
from agroclimate import compute_gdd, summarize_temperature
from region_service import describe_region, validate_region_polygon
from historical_service import analyze_history
from earth_observation_service import EarthObservationClient
from environment_service import analyze_environment
from daily2025_service import analyze_daily_2025
from decision_history_service import historical_decision_climate, historical_ndvi_context
import json

load_dotenv(Path(__file__).resolve().parent / ".env")
app = FastAPI(title="TerraAI Satellite Data API", version="0.5.0")
allowed = os.getenv("TERRAAI_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
client = CopernicusClient()
power_client = PowerClient()
earth_client = EarthObservationClient()


class NDVIRequest(BaseModel):
    polygon: dict
    start: date
    end: date
    interval: Literal["P10D", "P1M"] = "P10D"

    @field_validator("polygon")
    @classmethod
    def validate_polygon(cls, polygon: dict) -> dict:
        return validate_region_polygon(polygon)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start > self.end:
            raise ValueError("Start date must be before end date")
        if (self.end - self.start).days > 366:
            raise ValueError("Limit each request to one year")
        if self.end > date.today():
            raise ValueError("End date cannot be in the future")
        if self.start.year < 2017:
            raise ValueError("Sentinel-2 L2A coverage before 2017 is not supported by this prototype")
        return self


@app.get("/api/status")
async def status():
    return {"service": "TerraAI Satellite Data API", "copernicus_configured": client.configured,
            "nasa_power_available": True,
            "note": "NASA POWER requires no API credentials; live climate values are gridded model estimates. Copernicus needs backend OAuth credentials."}


@app.post("/api/ndvi")
async def ndvi(body: NDVIRequest):
    try:
        return await client.statistics(body.polygon, body.start, body.end, body.interval)
    except CopernicusError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


# NASA POWER endpoints. Point query is evaluated at the chosen field centroid,
# NOT the average of a field polygon. Longitude/latitude are WGS84 degrees.
def climate_parameters(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    start: date = Query(...),
    end: date = Query(...),
    cold_threshold: float = Query(0, ge=-70, le=50),
    heat_threshold: float = Query(35, ge=-20, le=70),
    tbase: float = Query(10, ge=-30, le=45),
    tupper: float = Query(30, ge=-20, le=70),
):
    if start > end:
        raise HTTPException(422, 'Start date must not be after end date.')
    if start < date(1981, 1, 1):
        raise HTTPException(422, 'NASA POWER daily data begins in 1981.')
    if end > date.today():
        raise HTTPException(422, 'End date cannot be in the future.')
    if (end - start).days > 366:
        raise HTTPException(422, 'Analyze up to 367 calendar days at a time.')
    if tupper <= tbase:
        raise HTTPException(422, 'GDD upper temperature must exceed basal temperature.')
    return dict(latitude=latitude, longitude=longitude, start=start, end=end,
                cold_threshold=cold_threshold, heat_threshold=heat_threshold,
                tbase=tbase, tupper=tupper)


async def climate_bundle(query):
    try:
        result = await power_client.daily(query['latitude'], query['longitude'], query['start'], query['end'])
    except PowerError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    rows = result['observations']
    return {
        **result,
        'summary': summarize_temperature(rows, query['cold_threshold'], query['heat_threshold']),
        'gdd': compute_gdd(rows, query['tbase'], query['tupper']),
    }


@app.get('/api/climate/temperature')
async def temperature(query: dict = Depends(climate_parameters)):
    return await climate_bundle(query)


@app.get('/api/climate/temperature-summary')
async def temperature_summary(query: dict = Depends(climate_parameters)):
    result = await climate_bundle(query)
    return {key: result[key] for key in ('source','status','start','end','location','time_standard','summary')}


@app.get('/api/climate/gdd')
async def gdd(query: dict = Depends(climate_parameters)):
    result = await climate_bundle(query)
    return {key: result[key] for key in ('source','status','start','end','location','time_standard','gdd')}


class RegionAnalysisRequest(NDVIRequest):
    """One selected GeoJSON field and one period for both data services."""
    cold_threshold: float = Field(0, ge=-70, le=50)
    heat_threshold: float = Field(35, ge=-20, le=70)


@app.post('/api/regions/analyze')
async def analyze_region(body: RegionAnalysisRequest):
    region = describe_region(body.polygon)
    point = region['representative_point']
    ndvi_result, temperature_result = await asyncio.gather(
        client.statistics(body.polygon, body.start, body.end, body.interval),
        power_client.daily(point['latitude'], point['longitude'], body.start, body.end),
        return_exceptions=True,
    )

    def dataset(result, source, spatial_method, error_type):
        if isinstance(result, Exception):
            if isinstance(result, error_type):
                message = str(result)
            else:
                message = f'{source} request failed unexpectedly. See backend logs.'
            return {'source': source, 'status': 'error', 'sampling_method': spatial_method,
                    'error': message, 'data': None}
        return {'source': source, 'status': 'success', 'sampling_method': spatial_method,
                'error': None, 'data': result}

    ndvi_data = dataset(ndvi_result, 'Copernicus Sentinel-2 L2A', 'selected_polygon', CopernicusError)
    climate_data = dataset(temperature_result, 'NASA POWER Daily API', 'representative_point', PowerError)
    if climate_data['status'] == 'success':
        climate_data['data'] = {
            **temperature_result,
            'summary': summarize_temperature(temperature_result['observations'], body.cold_threshold, body.heat_threshold),
        }
    return {
        'region': region,
        'period': {'start': body.start.isoformat(), 'end': body.end.isoformat()},
        'datasets': {'ndvi': ndvi_data, 'temperature': climate_data},
        'status': 'success' if ndvi_data['status'] == climate_data['status'] == 'success'
                  else 'partial' if 'success' in (ndvi_data['status'], climate_data['status']) else 'error',
        'note': 'NDVI samples the field polygon; NASA POWER samples one representative location and is a regional meteorological estimate.',
    }


class HistoricalRegionRequest(BaseModel):
    polygon: dict

    @field_validator('polygon')
    @classmethod
    def validate_polygon(cls, polygon: dict) -> dict:
        return validate_region_polygon(polygon)


@app.post('/api/regions/history')
async def historical_region(body: HistoricalRegionRequest):
    """Automatically query the six most recent completed calendar years.

    The client supplies a polygon only. Crop / tab changes do not call this route.
    """
    return await analyze_history(body.polygon, client, power_client)


@app.post('/api/regions/environment')
async def environmental_history(body: HistoricalRegionRequest):
    """Historical environmental variables with source-specific coverage, no manual dates."""
    return await analyze_environment(body.polygon, client, earth_client)


@app.post('/api/regions/environment/daily-2025')
async def daily_environment_2025(body: HistoricalRegionRequest):
    """2025 daily EO time series, one polygon, no manual dates."""
    return await analyze_daily_2025(body.polygon, client, earth_client)


@app.post('/api/regions/decisions/history')
async def decision_history(body: HistoricalRegionRequest):
    """Long historical record; 2025 contrasted with preceding complete years.

    Independent upstream products can fail without inventing observations.
    """
    thermal = json.loads((Path(__file__).parent / 'data' / 'decision_thermal_catalog.json').read_text(encoding='utf-8'))['crops']
    # Deployed backends may not include frontend files: use a backend catalog copy.
    return await historical_decision_climate(body.polygon, earth_client, thermal)


@app.post('/api/regions/decisions/ndvi-history')
async def decision_ndvi_history(body: HistoricalRegionRequest):
    """Historical field NDVI context; kept separate from crop suitability."""
    return await historical_ndvi_context(body.polygon, client)
