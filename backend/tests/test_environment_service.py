from datetime import date
from pathlib import Path
import asyncio
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import app
from environment_service import (monthly_aggregate, monthly_climatology, analyze_environment,
                                 SENTINEL_START, METEOROLOGY_START, IMERG_START, SMAP_START)
from earth_observation_service import build_daily_rows, clean_value, ObservationError, WEATHER_PARAMETERS

POLYGON={'type':'Polygon','coordinates':[[[-71.415,-33.322],[-71.410,-33.322],[-71.410,-33.319],[-71.415,-33.319],[-71.415,-33.322]]]}


def test_clean_missing_values_and_absence():
    assert clean_value(-999) is None
    assert clean_value(None) is None
    assert clean_value('bad') is None
    assert clean_value(False) is None
    assert clean_value(0) == 0
    assert build_daily_rows({'properties': {'parameter':{'T2M':{'20200101': -999,'20200102': 21.7}}}},
                            ('T2M',),date(2020,1,1),date(2020,1,2)) == [
        {'date':'2020-01-01','mean_c':None}, {'date':'2020-01-02','mean_c':21.7}]


def test_monthly_precipitation_requires_complete_month():
    rows=[{'date':f'2024-01-{day:02d}','precipitation_mm': 2} for day in range(1,32)]
    assert monthly_aggregate(rows,'precipitation_mm','sum')[0]['value']==62
    rows[0]['precipitation_mm']=None
    partial=monthly_aggregate(rows,'precipitation_mm','sum')[0]
    assert partial['value'] is None
    assert partial['valid_days']==30


def test_seasonality_uses_month_matched_years_not_annual_mean():
    data=[{'date':'2023-01-01','value':2},{'date':'2024-01-01','value':4},
          {'date':'2025-01-01','value':8},{'date':'2024-02-01','value':None}]
    profile=monthly_climatology(data)
    assert profile[0]['mean']==round(14/3,3)
    assert profile[0]['years_valid']==3
    assert profile[1]['mean'] is None
    assert profile[0]['p10'] < profile[0]['p90']


def test_environment_endpoint_rejects_non_polygon():
    client=TestClient(app)
    assert client.post('/api/regions/environment',json={'polygon':{'type':'Point','coordinates':[0,0]}}).status_code==422


def test_extended_environment_independent_services_and_long_history():
    class Cop:
        def __init__(self): self.calls=[]
        async def statistics(self,polygon,start,end,interval):
            self.calls.append(start.year)
            return {'observations':[{'date':f'{start.year}-06-01','mean_ndvi':0.5,'valid_pixels':5,'total_pixels':10,'valid_percent':50}]}
    class Power:
        def __init__(self): self.calls=[]
        async def daily(self,lat,lon,start,end,parameters,community,standard):
            self.calls.append((start,end,parameters,community,standard))
            if parameters==('SFMC','RZMC'):
                raise ObservationError('SMAP unavailable')
            if parameters==('IMERG_PRECTOT',):
                return [{'date':'2018-01-01','imerg_precipitation_mm':2}]
            return [{'date':'2025-01-01','mean_c':15,'min_c':9,'max_c':25,
                'relative_humidity_pct':55,'precipitation_mm':2,'solar_radiation_mj_m2_day':22,'wind_speed_ms':1.3}]
    cop,power=Cop(),Power()
    result=asyncio.run(analyze_environment(POLYGON,cop,power,today=date(2026,11,15)))
    assert power.calls[0][0] == METEOROLOGY_START
    assert any(call[0]==date(1984,1,1) for call in power.calls)
    assert any(call[0]==SMAP_START for call in power.calls)
    assert any(call[0]==IMERG_START for call in power.calls)
    assert cop.calls==list(range(SENTINEL_START.year,2026))
    assert result['datasets']['temperature']['monthly'][0]['value']==15
    assert result['datasets']['humidity']['monthly'][0]['value']==55
    assert result['datasets']['soil_moisture']['status']=='error'
    assert result['datasets']['ndvi']['coverage']['valid_months']==9
    assert result['datasets']['ndvi']['metadata']['cloud_mask']=='SCL 4/5'
    assert result['period']['auto_selected'] is True
    assert result['soil_chemistry']['status']=='unavailable'


def test_imerg_failure_falls_back_to_power_and_ndvi_failure_is_not_filled():
    class Cop:
        async def statistics(self,polygon,start,end,interval):
            raise Exception('Offline')
    class Power:
        async def daily(self,lat,lon,start,end,parameters,community,standard):
            if parameters==('IMERG_PRECTOT',):
                raise ObservationError('IMERG unavailable')
            if parameters==('SFMC','RZMC'):
                return [{'date':'2025-01-01','surface_moisture_m3_m3':0.21,'rootzone_moisture_m3_m3':0.31}]
            return [{'date':'2025-01-01','mean_c':12,'min_c':5,'max_c':17,
                     'relative_humidity_pct':70,'precipitation_mm':3,'solar_radiation_mj_m2_day':10,'wind_speed_ms':2}]
    result=asyncio.run(analyze_environment(POLYGON,Cop(),Power(),today=date(2026,11,15)))
    assert result['datasets']['ndvi']['status']=='error'
    assert all(row['value'] is None for row in result['datasets']['ndvi']['monthly'])
    assert result['datasets']['precipitation']['source'].startswith('NASA POWER')
    assert 'IMERG unavailable' in result['datasets']['precipitation']['metadata']['gpm_imerg_status']
    assert result['datasets']['soil_moisture']['monthly'][0]['value']==0.21
