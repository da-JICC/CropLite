import asyncio
import json
import math
import sys
from datetime import date
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from daily2025_service import daily_vpd, daily_eto, analyze_daily_2025, DAYS, daily_ndvi_rows
from test_api import POLYGON


def test_2025_is_exactly_365_daily_dates():
    assert DAYS[0] == '2025-01-01'
    assert DAYS[-1] == '2025-12-31'
    assert len(DAYS) == 365
    assert len(set(DAYS)) == 365


def test_vpd_uses_dewpoint_and_nulls():
    assert daily_vpd(30, 10, 10) > 1.2
    assert daily_vpd(30, 10, None) is None
    assert daily_vpd(10, 10, 10) == 0


def test_eto_fao56_typical_positive_and_missing():
    value = daily_eto(22,14,30,12,2,100,22,-33,16)
    assert value is not None
    assert 2 < value < 10
    assert daily_eto(22,14,30,None,2,100,22,-33,16) is None
    assert daily_eto(22,14,30,12,2,100,None,-33,16) is None


def test_ndvi_ndmi_missing_days_are_not_interpolated():
    results=[(1,{'observations':[{'date':'2025-01-07','mean_ndvi':0.55,'mean_ndmi':0.17,
            'valid_pixels':20,'total_pixels':40,'valid_percent':50}]},None),
             (2,None,'API error')]
    ndvi,ndmi,failures=daily_ndvi_rows(results)
    assert len(ndvi)==len(ndmi)==365
    assert ndvi[6]['value']==0.55 and ndmi[6]['value']==0.17
    assert ndvi[5]['value'] is None and ndmi[7]['value'] is None
    assert failures == {'02':'API error'}


def test_crop_catalog_20_and_null_thresholds_preserved():
    path=Path(__file__).resolve().parents[1]/'data/crop_agronomic_parameters.json'
    crops=json.loads(path.read_text(encoding='utf-8'))['crops']
    assert len(crops)==20
    wheat=next(c for c in crops if c['name']=='Trigo')
    assert wheat['thermal']['gdd_base_c']==0
    assert wheat['water']['kc_by_stage']['mid']==1.15
    assert wheat['water']['cycle_days']=={'min':120,'max':150}
    assert wheat['soil']['ph_optimum'] is None
    assert wheat['water']['soil_moisture_threshold_m3_m3'] is None


def test_2025_independent_sources_and_indicators():
    class Weather:
        def __init__(self):self.calls=[]
        async def daily(self,lat,lon,start,end,params,community,standard):
            self.calls.append((start,end,params,community,standard))
            assert start==date(2025,1,1) and end==date(2025,12,31)
            if params==('SFMC','RZMC'):raise RuntimeError('soil unavailable')
            if params==('IMERG_PRECTOT',):return [{'date':'2025-01-01','imerg_precipitation_mm':4}]
            if params==('ALLSKY_SFC_SW_DWN',):return [{'date':'2025-01-01','solar_radiation_mj_m2_day':22}]
            return [{'date':'2025-01-01','mean_c':22,'min_c':15,'max_c':30,'dewpoint_c':12,
                     'relative_humidity_pct':62,'precipitation_mm':5,'wind_speed_ms':2,
                     'surface_pressure_kpa':100}]
    class Cop:
        def __init__(self):self.calls=[]
        async def statistics(self,polygon,start,end,interval,*,include_ndmi=False):
            self.calls.append((start,end,interval,include_ndmi))
            if start.month==2:raise RuntimeError('cloud service failure')
            return {'observations':[{'date':f'2025-{start.month:02d}-05','mean_ndvi':.5,'mean_ndmi':.1,
                    'valid_pixels':12,'total_pixels':14,'valid_percent':85.7}]}
    w,c=Weather(),Cop()
    result=asyncio.run(analyze_daily_2025(POLYGON,c,w))
    assert result['period']['interval']=='daily'
    assert len(c.calls)==12
    assert all(call[2]=='P1D' and call[3] for call in c.calls)
    assert len(result['datasets']['temperature']['daily'])==365
    assert result['datasets']['temperature']['daily'][0]['value']==22
    assert result['datasets']['vpd']['daily'][0]['value']>0
    assert result['datasets']['eto']['daily'][0]['value']>0
    assert result['datasets']['rain_cumulative']['daily'][0]['value']==5
    assert result['datasets']['rain_cumulative']['daily'][1]['value'] is None
    assert result['datasets']['ndvi']['daily'][35]['value'] is None
    assert result['datasets']['ndmi']['daily'][4]['value']==.1
    assert result['datasets']['soil_moisture']['status']=='unavailable'
    assert result['datasets']['ndvi']['metadata']['failed_months'] == {'02':'RuntimeError: cloud service failure'}
    assert result['datasets']['precipitation']['source'].endswith('GPM IMERG')
