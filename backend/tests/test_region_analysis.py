"""Offline integrated-analysis tests: both NASA and Copernicus are mocked."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import app, client, power_client
from copernicus import CopernicusError
from region_service import describe_region, validate_region_polygon

http = TestClient(app)
POLYGON = {'type': 'Polygon', 'coordinates': [[
    [-71.415, -33.322], [-71.410, -33.322],
    [-71.410, -33.319], [-71.415, -33.319], [-71.415, -33.322]
]]}
PAYLOAD = {'polygon': POLYGON, 'start': '2026-01-01', 'end': '2026-01-03',
           'interval': 'P10D', 'cold_threshold': 0, 'heat_threshold': 35}


def test_region_metadata_and_point_in_field():
    validated = validate_region_polygon(POLYGON)
    result = describe_region(validated)
    assert 10 < result['area_hectares'] < 20  # ~465m x 330m
    assert -71.415 < result['representative_point']['longitude'] < -71.410
    assert -33.322 < result['representative_point']['latitude'] < -33.319
    assert result['geometry'] == POLYGON


def test_rejects_crossed_polygons_and_nonfinite_coordinates():
    crossed = {'type': 'Polygon', 'coordinates': [[
        [0,0], [0.01,0.01], [0,0.01], [0.01,0], [0,0]]
    ]}
    assert http.post('/api/regions/analyze', json={**PAYLOAD, 'polygon': crossed}).status_code == 422
    malformed = {'type':'Polygon','coordinates': [[[0,0],[0.001,0],[0,0.001],[0.001,0]]]}
    assert http.post('/api/regions/analyze',json={**PAYLOAD,'polygon':malformed}).status_code==422


def test_unified_api_retrieves_both_sources(monkeypatch):
    async def fake_statistics(polygon, start, end, interval):
        assert polygon == POLYGON
        assert str(start) == '2026-01-01' and str(end) == '2026-01-03'
        return {'status':'observed','source':'Copernicus Sentinel-2 L2A',
                'observations':[{'date':'2026-01-01','mean_ndvi':0.42,'valid_percent':85}]}
    async def fake_daily(lat, lon, start, end):
        assert -33.322 < lat < -33.319
        assert -71.415 < lon < -71.410
        return {'source':'NASA POWER Daily API','status':'model_estimate',
                'observations':[{'date':'2026-01-01','mean_c':18,'min_c':4,'max_c':38},
                                {'date':'2026-01-02','mean_c':20,'min_c':3,'max_c':30}]}
    monkeypatch.setattr(client, 'statistics', fake_statistics)
    monkeypatch.setattr(power_client, 'daily', fake_daily)
    resp=http.post('/api/regions/analyze',json=PAYLOAD)
    assert resp.status_code==200
    obj=resp.json()
    assert obj['status']=='success'
    assert obj['datasets']['ndvi']['status']=='success'
    assert obj['datasets']['temperature']['data']['summary']['heat_exposure_days']==1
    assert obj['datasets']['temperature']['data']['summary']['mean_temperature_c']==19
    assert obj['datasets']['ndvi']['sampling_method']=='selected_polygon'
    assert obj['datasets']['temperature']['sampling_method']=='representative_point'


def test_partial_success_preserves_nasa_when_copernicus_fails(monkeypatch):
    async def fake_statistics(*a,**kw):
        raise CopernicusError('Copernicus OAuth credentials not configured',503)
    async def fake_daily(*a,**kw):
        return {'source':'NASA POWER Daily API','status':'model_estimate',
                'observations':[{'date':'2026-01-01','mean_c':12,'min_c':5,'max_c':22}]}
    monkeypatch.setattr(client, 'statistics', fake_statistics)
    monkeypatch.setattr(power_client, 'daily', fake_daily)
    obj=http.post('/api/regions/analyze',json=PAYLOAD).json()
    assert obj['status']=='partial'
    assert obj['datasets']['ndvi']['status']=='error'
    assert obj['datasets']['temperature']['status']=='success'


def test_old_ndvi_api_is_still_registered():
    paths={r.path for r in app.routes}
    assert '/api/ndvi' in paths
    assert '/api/climate/temperature' in paths
    assert '/api/regions/analyze' in paths
