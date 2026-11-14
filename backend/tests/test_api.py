"""Tests run without contacting Copernicus or consuming API quota."""
from datetime import date
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import app, client as cdse_client
from copernicus import CopernicusClient, EVALSCRIPT

http = TestClient(app)

POLYGON = {
    "type": "Polygon",
    "coordinates": [[
        [-71.415, -33.322], [-71.410, -33.322],
        [-71.410, -33.319], [-71.415, -33.319], [-71.415, -33.322]
    ]],
}


def sample(**kwargs):
    return {"polygon": POLYGON, "start": "2026-01-01", "end": "2026-02-01", "interval": "P10D", **kwargs}


def test_status_reports_service_and_not_secrets():
    response = http.get('/api/status')
    assert response.status_code == 200
    assert 'copernicus_configured' in response.json()
    assert 'client_secret' not in str(response.json())


def test_rejects_large_field():
    bad = {"type": "Polygon", "coordinates": [[[-71.8,-33.1],[-71.0,-33.1],[-71.0,-33.3],[-71.8,-33.1]]]}
    response = http.post('/api/ndvi', json={**sample(), "polygon": bad})
    assert response.status_code == 422


def test_rejects_invalid_dates_and_future():
    response = http.post('/api/ndvi',json={**sample(), "start":"2026-10-01", "end":"2026-01-01"})
    assert response.status_code == 422
    response = http.post('/api/ndvi',json={**sample(), "end":"2028-01-01"})
    assert response.status_code == 422


def test_requires_credentials_without_live_network(monkeypatch):
    monkeypatch.delenv("CDSE_CLIENT_ID",raising=False)
    monkeypatch.delenv("CDSE_CLIENT_SECRET",raising=False)
    response = http.post('/api/ndvi', json=sample())
    assert response.status_code == 503
    assert 'credentials' in response.json()['detail'].lower()


def test_ndvi_mask_uses_sentinel_bands_and_cloud_classification():
    for band in ('B04','B08','SCL','dataMask'):
        assert band in EVALSCRIPT
    assert 'SCL === 4' in EVALSCRIPT
    assert 'SCL === 5' in EVALSCRIPT


def test_mocked_live_endpoint(monkeypatch):
    async def fake_statistics(*args,**kwargs):
        return {"source":"Copernicus Sentinel-2 L2A","status":"observed","observations": [{"date":"2026-01-01","mean_ndvi":0.66}]}
    monkeypatch.setattr(cdse_client,'statistics',fake_statistics)
    response=http.post('/api/ndvi', json=sample())
    assert response.status_code == 200
    assert response.json()['observations'][0]['mean_ndvi'] == 0.66
