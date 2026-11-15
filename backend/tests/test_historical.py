"""Offline validation for six complete historical years and partial-source recovery."""
from datetime import date
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app import app, client, power_client
from historical_service import completed_years, annual_temperature_summary, annual_ndvi_summary, analyze_history
from copernicus import CopernicusError

POLYGON = {'type':'Polygon','coordinates':[[
    [-71.415,-33.322],[-71.410,-33.322],[-71.410,-33.319],[-71.415,-33.319],[-71.415,-33.322]
]]}


def test_six_last_complete_years_around_new_year():
    assert completed_years(date(2026, 11, 15)) == [2020,2021,2022,2023,2024,2025]
    assert completed_years(date(2027, 1, 1)) == [2021,2022,2023,2024,2025,2026]


def test_no_fabricated_temperature_or_ndvi_values():
    temp = annual_temperature_summary([
        {'date':'2024-01-01','mean_c':15,'min_c':8,'max_c':22},
        {'date':'2024-01-02','mean_c':None,'min_c':None,'max_c':None},
        {'date':'2024-01-03','mean_c':20,'min_c':10,'max_c':28}
    ],2024)
    assert temp['expected_days'] == 366
    assert temp['valid_days'] == 2
    assert temp['mean_c'] == 17.5
    assert temp['quality'] == 'partial'
    ndvi = annual_ndvi_summary([
        {'date':'2024-01-01','mean_ndvi':0.5},
        {'date':'2024-02-01','mean_ndvi':None},
        {'date':'2024-03-01','mean_ndvi':0.3},
    ],2024)
    assert ndvi['valid_intervals'] == 2
    assert ndvi['mean_ndvi'] == 0.4
    assert ndvi['coverage_percent'] == 16.7


def test_historical_endpoint_rejects_invalid_polygon():
    test_client = TestClient(app)
    assert test_client.post('/api/regions/history', json={'polygon': {'type':'Point','coordinates':[0,0]}}).status_code == 422


def test_six_years_one_power_request_six_ndvi_year_requests(monkeypatch):
    cop_calls = []
    power_calls = []
    async def fake_cop(polygon,start,end,interval):
        cop_calls.append((start,end,interval))
        return {'observations':[{'date':f'{start.year}-01-01','mean_ndvi':0.5,'valid_percent':80}]}
    async def fake_power(lat,lon,start,end):
        power_calls.append((lat,lon,start,end))
        return {'observations':[{'date':'2024-01-01','mean_c':22,'min_c':10,'max_c':32}], 'time_standard':'LST'}
    monkeypatch.setattr(client,'statistics', fake_cop)
    monkeypatch.setattr(power_client,'daily', fake_power)
    import asyncio
    result = asyncio.run(analyze_history(POLYGON,client,power_client,today=date(2026,11,15)))
    assert len(cop_calls)==6
    assert [d[0].year for d in cop_calls] == [2020,2021,2022,2023,2024,2025]
    assert all(v[2]=='P1M' for v in cop_calls)
    assert len(power_calls)==1
    assert power_calls[0][2] == date(2020,1,1)
    assert power_calls[0][3] == date(2025,12,31)
    assert result['period']['auto_selected'] is True
    assert result['status']=='partial'  # Sparse NASA mock data
    assert len(result['datasets']['ndvi']['data']['observations'])==72
    assert sum(row['mean_ndvi'] is not None for row in result['datasets']['ndvi']['data']['observations'])==6


def test_partial_copernicus_failures_preserve_other_years_and_nasa(monkeypatch):
    async def fake_cop(polygon,start,end,interval):
        if start.year == 2022:
            raise CopernicusError('Quota exceeded',429)
        return {'observations':[{'date':f'{start.year}-04-01','mean_ndvi':0.6}]}
    async def fake_power(*args):
        return {'observations':[{'date':'2025-01-01','mean_c':16,'min_c':4,'max_c':21}]}
    monkeypatch.setattr(client,'statistics', fake_cop)
    monkeypatch.setattr(power_client,'daily', fake_power)
    import asyncio
    result=asyncio.run(analyze_history(POLYGON,client,power_client,today=date(2026,11,15)))
    ndvi=result['datasets']['ndvi']
    assert ndvi['status']=='partial'
    assert '2022' in ndvi['data']['errors_by_year']
    assert len(ndvi['data']['observations'])==60
    assert result['datasets']['temperature']['status']=='partial'


def test_nasa_failure_does_not_erase_ndvi(monkeypatch):
    async def fake_cop(polygon,start,end,interval):
        return {'observations':[{'date':f'{start.year}-04-01','mean_ndvi':0.35}]}
    from nasa_power_service import PowerError
    async def fake_power(*args):
        raise PowerError('NASA is offline', 502)
    monkeypatch.setattr(client,'statistics', fake_cop)
    monkeypatch.setattr(power_client,'daily', fake_power)
    import asyncio
    result = asyncio.run(analyze_history(POLYGON,client,power_client,today=date(2026,11,15)))
    assert result['datasets']['ndvi']['status']=='success'
    assert result['datasets']['temperature']['status']=='error'
    assert len(result['datasets']['ndvi']['data']['observations'])==72
    assert sum(row['mean_ndvi'] is not None for row in result['datasets']['ndvi']['data']['observations'])==6
