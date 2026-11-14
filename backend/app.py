"""Small TerraAI Copernicus API backend. Run `uvicorn app:app --reload --port 8000`."""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from copernicus import CopernicusClient, CopernicusError

load_dotenv(Path(__file__).resolve().parent / ".env")
app = FastAPI(title="TerraAI Satellite Data API", version="0.2.0")
allowed = os.getenv("TERRAAI_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
client = CopernicusClient()


class NDVIRequest(BaseModel):
    polygon: dict
    start: date
    end: date
    interval: Literal["P10D", "P1M"] = "P10D"

    @field_validator("polygon")
    @classmethod
    def validate_polygon(cls, polygon: dict) -> dict:
        if polygon.get("type") != "Polygon":
            raise ValueError("Only GeoJSON Polygon is supported")
        coords = polygon.get("coordinates")
        if not isinstance(coords, list) or len(coords) != 1:
            raise ValueError("A single polygon ring is required")
        ring = coords[0]
        if not isinstance(ring, list) or not 4 <= len(ring) <= 41 or ring[0] != ring[-1]:
            raise ValueError("The polygon must be closed and contain 3 to 40 vertices")
        if any(not isinstance(p, (list, tuple)) or len(p) != 2 or
               not all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in p) or
               not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in ring):
            raise ValueError("Polygon coordinates must be [longitude, latitude] within WGS84 bounds")
        if len({(p[0], p[1]) for p in ring[:-1]}) < 3:
            raise ValueError("The polygon needs 3 different points")
        longs, lats = [p[0] for p in ring], [p[1] for p in ring]
        if max(longs) - min(longs) > 0.10 or max(lats) - min(lats) > 0.10:
            raise ValueError("The field must fit within roughly 10 km; draw a smaller area")
        signed_area = sum((a[0] * b[1] - b[0] * a[1]) for a, b in zip(ring, ring[1:])) / 2
        if abs(signed_area) < 1e-10:
            raise ValueError("Polygon area must not be zero")
        return polygon

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
    return {"service": "TerraAI NDVI", "copernicus_configured": client.configured,
            "note": "Live requests need CDSE OAuth credentials on the backend; demo data is explicitly simulated."}


@app.post("/api/ndvi")
async def ndvi(body: NDVIRequest):
    try:
        return await client.statistics(body.polygon, body.start, body.end, body.interval)
    except CopernicusError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
