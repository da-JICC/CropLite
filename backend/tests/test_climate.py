"""Offline climate tests: no calls to NASA, no API quota needed."""
from datetime import date
from pathlib import Path
import sys
import pytest
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import app, power_client
from agroclimate import compute_gdd, summarize_temperature
from nasa_power_service import PowerClient, PowerError, as_value

http = TestClient(app)
BASE = {'latitude':-33.32, 'longitude':-71.41, 'start':'2026-01-01', 'end':'2026-01-04'}


def rows():
    return [
        {'date':'2026-01-01','mean_c':10,'min_c':-2,'max_c':36,'relative_humidity_pct':55},
        {'date':'2026-01-02','mean_c':19,'min_c':1,'max_c':33,'relative_humidity_pct':67},
        {'date':'2026-01-03','mean_c':None,'min_c':None,'max_c':None,'relative_humidity_pct':None},
        {'date':'2026-01-04','mean_c':31,'min_c':-1,'max_c':37,'relative_humidity_pct':60},
    ]


def test_gdd_and_missing_intervals():
    result = compute_gdd(rows(),10,30)
    assert result['total_gdd_c_day']==29  # 0 + 9 + 20
    assert result['daily'][2]['daily_gdd'] is None
    assert result['daily'][2]['cumulative_gdd'] is None
    assert result['daily'][3]['cumulative_gdd']==29
    assert result['valid_days']==3
    with pytest.raises(ValueError):
        compute_gdd(rows(),30,10)


def test_temperature_screens_not_injury_predictions():
    data = summarize_temperature(rows(),cold_threshold=0,heat_threshold=35)
    assert data['mean_temperature_c']==20
    assert data['absolute_max_temperature_c']==37
    assert data['absolute_min_temperature_c']==-2
    assert data['heat_exposure_days']==2
    assert data['cold_exposure_days']==2
    assert data['max_consecutive_heat_days']==1  # missing day splits streaks
    assert data['missing_mean_days']==1


def test_missing_values_and_valid_negative_temp():
    assert as_value(-4.5)==-4.5
    assert as_value(-999) is None
    assert as_value(None) is None
    assert as_value('not a number') is None


def test_api_input_validation():
    assert http.get('/api/climate/temperature',params={**BASE,'latitude':95}).status_code==422
    assert http.get('/api/climate/gdd',params={**BASE,'tbase':30,'tupper':10}).status_code==422
    assert http.get('/api/climate/temperature',params={**BASE,'start':'2026-02-01','end':'2026-01-04'}).status_code==422
    assert http.get('/api/climate/temperature',params={**BASE,'end':'2035-01-01'}).status_code==422
    assert http.get('/api/climate/temperature',params={**BASE,'start':'2020-01-01','end':'2026-01-04'}).status_code==422


def test_three_climate_endpoints_keep_ndvi_untouched(monkeypatch):
    async def fake_daily(latitude, longitude, start, end):
        return {
            'source':'NASA POWER Daily API','status':'model_estimate',
            'location':{'latitude':latitude,'longitude':longitude},
            'time_standard':'LST', 'start':str(start),'end':str(end),
            'observations':rows(),
        }
    monkeypatch.setattr(power_client, 'daily', fake_daily)
    detailed=http.get('/api/climate/temperature', params={**BASE,'tbase':10,'tupper':30})
    assert detailed.status_code==200
    assert detailed.json()['gdd']['total_gdd_c_day']==29
    assert detailed.json()['summary']['heat_exposure_days']==2
    assert detailed.json()['observations'][0]['relative_humidity_pct']==55
    summary=http.get('/api/climate/temperature-summary',params=BASE)
    assert summary.status_code==200
    assert summary.json()['summary']['absolute_min_temperature_c']==-2
    assert 'observations' not in summary.json()
    gdd=http.get('/api/climate/gdd',params=BASE)
    assert gdd.status_code==200
    assert 'total_gdd_c_day' in gdd.json()['gdd']
    status=http.get('/api/status')
    assert status.status_code==200
    assert status.json()['nasa_power_available'] is True


def test_nasa_response_parsing_and_cache(monkeypatch):
    import asyncio
    class Response:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {'properties':{'parameter':{
                'T2M':{'20260101':20.2,'20260102':-999},
                'T2M_MAX':{'20260101':30.0,'20260102':-999},
                'T2M_MIN':{'20260101':10.0,'20260102':-999},
                'RH2M':{'20260101':60,'20260102':-999},
            }}}
    calls=[]
    class FakeClient:
        def __init__(self,*args,**kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def get(self,url,params):
            calls.append((url,params));return Response()
    monkeypatch.setattr('nasa_power_service.httpx.AsyncClient',FakeClient)
    p=PowerClient()
    a=asyncio.run(p.daily(-33.32,-71.41,date(2026,1,1),date(2026,1,2)))
    b=asyncio.run(p.daily(-33.32,-71.41,date(2026,1,1),date(2026,1,2)))
    assert a is b and len(calls)==1
    assert a['status']=='model_estimate'
    assert a['observations'][1]['mean_c'] is None
    assert a['observations'][0]['mean_c']==20.2
    assert calls[0][1]['parameters']=='T2M,T2M_MAX,T2M_MIN,RH2M'
