"""Offline tests: historical analogue ranking, missing data, non-fabrication."""
import asyncio
import json
from datetime import date,timedelta
from pathlib import Path

from decision_engine import build_decision_report, select_analogue_years, year_summary, _scenario_cycle, CATALOG
from decision_history_service import historical_decision_climate, historical_ndvi_context
from test_api import POLYGON

THERMAL = json.loads((Path(__file__).resolve().parents[1]/'data'/'decision_thermal_catalog.json').read_text())['crops']


def synthetic():
    rows,solar=[],[]
    for year in range(2014,2026):
        day=date(year,1,1)
        while day.year==year:
            t=18+(year-2014)*.2
            rows.append({'date':str(day),'mean_c':t,'min_c':t-6,'max_c':t+9,
                         'precipitation_mm':1 if year==2014 else 3,
                         'wind_speed_ms':2.1,'dewpoint_c':11,'relative_humidity_pct':60,
                         'surface_pressure_kpa':101})
            solar.append({'date':str(day),'solar_radiation_mj_m2_day':17})
            day+=timedelta(days=1)
    return rows,solar


def test_history_uses_all_eligible_years_not_six():
    weather,solar=synthetic()
    report=build_decision_report(weather,solar,THERMAL,target_year=2027)
    assert report['status']=='evaluated'
    assert report['coverage']['baseline_valid_years']==11
    assert report['coverage']['baseline_first']==2014
    assert report['coverage']['baseline_last']==2024
    assert report['analogues']['dry']['year']==2014
    assert report['analogues']['warm']['year']==2024
    assert report['recent_comparison']['available']
    assert len(report['seasonal_profile'])==12
    assert len(report['ranked'])==6
    assert all(0 <= item['score'] <= 100 for item in report['ranked'])
    assert all(item['sow_date'].startswith('2027') and item['harvest_date'].startswith('2027') for item in report['ranked'])


def test_2025_is_held_out_for_historical_scenario_selection():
    weather,solar=synthetic()
    a=build_decision_report(weather,solar,THERMAL,target_year=2027)
    for row in weather:
        if row['date'].startswith('2025'):
            row['mean_c']+=10;row['precipitation_mm']=0
    b=build_decision_report(weather,solar,THERMAL,target_year=2027)
    assert a['analogues']==b['analogues']
    assert a['ranked']==b['ranked']
    assert a['recent_comparison']!=b['recent_comparison']


def test_missing_year_not_eligible_without_faking_observations():
    weather,solar=synthetic()
    weather=[r for r in weather if not(r['date'].startswith('2018') and r['date'][5:7] in ('03','04'))]
    result=build_decision_report(weather,solar,THERMAL)
    assert result['coverage']['baseline_valid_years']==10
    bad=next(x for x in result['annual_summary'] if x['year']==2018)
    assert bad['eligible'] is False
    assert bad['temperature_coverage']<.9


def test_incomplete_history_does_not_rank():
    weather,solar=synthetic()
    weather=[r for r in weather if r['date'].startswith('2025') or r['date'].startswith('2024')]
    result=build_decision_report(weather,solar,THERMAL)
    assert result['status']=='insufficient'
    assert result['ranked']==[]
    assert result['rotations']==[]


def test_only_real_comparable_crop_parameters_are_used():
    weather,solar=synthetic()
    from decision_engine import rank_crops
    years={r['date']:r for r in weather if r['date'].startswith('2024')}
    wheat=next(c for c in CATALOG['crops'] if c['id']=='wheat')
    value=_scenario_cycle(wheat,None,years,2024,0,2027,-33)
    assert value is None  # no invented temperature optimum


def test_rotations_do_not_overlap_or_repeat_families():
    weather,solar=synthetic()
    result=build_decision_report(weather,solar,THERMAL)
    for rotation in result['rotations']:
        a,b=rotation['crops']
        assert a['family']!=b['family']
        assert date.fromisoformat(a['harvest_date'])+timedelta(days=15)<=date.fromisoformat(b['sow_date'])
        assert b['harvest_date'].startswith(str(result['planning_year']))


def test_eto_is_missing_not_invented_without_radiation():
    weather,solar=synthetic()
    result=build_decision_report(weather,[],THERMAL)
    assert result['status']=='evaluated'
    assert all(s['etc_mm'] is None and s['rain_etc_ratio'] is None for c in result['ranked'] for s in c['scenario_results'].values())


def test_independent_products_do_not_block_ranking():
    weather,solar=synthetic()
    class Obs:
        async def daily(self,lat,lon,start,end,parameters,community,standard):
            if parameters==('SFMC','RZMC') or parameters==('IMERG_PRECTOT',):
                raise RuntimeError('remote source unavailable')
            if parameters==('ALLSKY_SFC_SW_DWN',):return solar
            return weather
    result=asyncio.run(historical_decision_climate(POLYGON,Obs(),THERMAL))
    assert result['status']=='evaluated'
    assert result['source_status']['meteorology']['available']
    assert not result['source_status']['soil_moisture']['available']
    assert not result['source_status']['gpm_precipitation']['available']


def test_ndvi_context_partial_failures_not_imputed():
    class Cop:
        configured=True
        async def statistics(self,poly,start,end,interval):
            if start.year==2020:raise RuntimeError('no access')
            return {'observations':[{'date':f'{start.year}-02-01','mean_ndvi':.42},
                                    {'date':f'{start.year}-03-01','mean_ndvi':None}]}
    result=asyncio.run(historical_ndvi_context(POLYGON,Cop()))
    assert result['status']=='partial'
    assert len(result['annual'])==9
    assert next(row for row in result['annual'] if row['year']==2020)['ndvi_mean'] is None
    assert next(row for row in result['annual'] if row['year']==2021)['months_with_valid_ndvi']==1


def test_ndvi_no_credentials_does_not_call_remote():
    class Cop:
        configured=False
        async def statistics(self,*args,**kwargs):raise AssertionError('should not fetch')
    result=asyncio.run(historical_ndvi_context(POLYGON,Cop()))
    assert result['status']=='unavailable'
