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
    assert len(report['ranked'])==10
    assert all(0 <= item['score'] <= 100 for item in report['ranked'])
    assert all(item['sow_date'].startswith('2027') for item in report['ranked'])
    assert report['planning_years']==[2027]
    assert all(item['history_sample_years']>=3 for item in report['ranked'])


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


def test_rotations_fit_into_one_year_and_do_not_repeat_families():
    weather,solar=synthetic()
    result=build_decision_report(weather,solar,THERMAL)
    assert result['planning_years']==[result['planning_year']]
    assert result['planning_assumptions']['years']==1
    assert result['rotations']
    for rotation in result['rotations']:
        assert len(rotation['crops'])==2
        a,b=rotation['crops']
        assert a['family'] != b['family']
        assert a['crop_id'] != b['crop_id']
        assert rotation['species_count']==2
        assert rotation['years']==[result['planning_year']]
        assert rotation['legume_present']==any(c['family']=='Fabaceae' for c in rotation['crops'])
        assert all(date.fromisoformat(c['sow_date']).year==result['planning_year'] and
                   date.fromisoformat(c['harvest_date']).year==result['planning_year'] for c in rotation['crops'])
        assert date.fromisoformat(a['harvest_date'])+timedelta(days=15) <= date.fromisoformat(b['sow_date'])


def test_one_year_planner_excludes_cross_year_and_same_family():
    from decision_engine import _rotations
    def candidate(cid,family,sow,cycle,score=80):
        return {'crop_id':cid,'crop_name':cid,'family':family,
                'sow_date':sow,'harvest_date':str(date.fromisoformat(sow)+timedelta(days=cycle-1)),
                'cycle_days':cycle,'score':score,'sow_day_offset':(date.fromisoformat(sow)-date(2027,1,1)).days}
    pool={
      'a':[candidate('wheat','Poaceae','2027-01-10',120)],
      'b':[candidate('papa','Solanaceae','2027-06-01',110)],
      'c':[candidate('maize','Poaceae','2027-08-01',145)],
      'd':[candidate('girasol','Asteraceae','2027-11-01',120)]
    }
    plans=_rotations(pool,2027)
    assert any([c['crop_id'] for c in p['crops']]==['wheat','papa'] for p in plans)
    assert all(c['harvest_date']<='2027-12-31' for p in plans for c in p['crops'])
    assert all(p['crops'][0]['family']!=p['crops'][1]['family'] for p in plans)


def test_eto_is_missing_not_invented_without_radiation():
    weather,solar=synthetic()
    result=build_decision_report(weather,[],THERMAL)
    assert result['status']=='evaluated'
    assert all(s['etc_mm'] is None and s['etc_source']=='Rango de ETc por ciclo (Excel)'
               for c in result['ranked'] for s in c['scenario_results'].values())
    # A documented reference ETc is usable as a screening benchmark; it is NOT
    # silently reported as a weather-derived evapotranspiration measurement.
    assert any(s['rain_etc_ratio'] is not None for c in result['ranked'] for s in c['scenario_results'].values())


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


def test_four_new_crops_use_distinct_original_excel_families():
    ids={c['id'] for c in CATALOG['crops']}
    assert len(ids)==10
    assert {'papa','girasol','poroto-seco','repollo'} <= ids
    from decision_engine import FAMILIES, AGRONOMY
    assert FAMILIES['papa']=='Solanaceae'
    assert FAMILIES['girasol']=='Asteraceae'
    assert FAMILIES['poroto-seco']=='Fabaceae'
    assert FAMILIES['repollo']=='Brassicaceae'
    assert AGRONOMY['papa']['ph']['preferred_min']==5


def test_rainfall_contributes_to_score_under_rainfed_assumption():
    weather,solar=synthetic()
    from decision_engine import _scenario_cycle
    crop=next(c for c in CATALOG['crops'] if c['id']=='wheat')
    ref=next(c for c in THERMAL if c['id']=='wheat')
    year={r['date']:r for r in weather if r['date'].startswith('2020')}
    wet=_scenario_cycle(crop,ref,year,2020,1,2027,-33)
    dry={key:{**row,'precipitation_mm':0} for key,row in year.items()}
    drier=_scenario_cycle(crop,ref,dry,2020,1,2027,-33)
    assert wet['score']>drier['score']
    assert wet['score_components_pct']['rainfed_water']>drier['score_components_pct']['rainfed_water']
    assert drier['score_components_pct']['rainfed_water']==0


def test_cross_year_sowing_uses_only_observed_adjacent_dates():
    weather,solar=synthetic()
    from decision_engine import _scenario_cycle
    crop=next(c for c in CATALOG['crops'] if c['id']=='wheat')
    ref=next(c for c in THERMAL if c['id']=='wheat')
    by_date={r['date']:r for r in weather if r['date'].startswith(('2018','2019'))}
    evaluated=_scenario_cycle(crop,ref,by_date,2018,275,2027,-33)
    assert evaluated is not None
    assert evaluated['harvest_date'].startswith('2028')
    assert evaluated['rain_coverage']==1
    assert evaluated['temperature_coverage']==1
    # Missing the following observed year must NOT be filled synthetically.
    missing={key:row for key,row in by_date.items() if key.startswith('2018')}
    assert _scenario_cycle(crop,ref,missing,2018,275,2027,-33) is None


def test_soil_is_not_invented_or_added_to_score():
    weather,solar=synthetic()
    report=build_decision_report(weather,solar,THERMAL)
    assert report['planning_assumptions']['soil_measured'] is False
    assert 'pH' not in report['decision_dimensions']
    assert 'rainfed_water' in next(iter(report['ranked'][0]['scenario_results'].values()))['score_components_pct']


def test_flooded_rice_is_not_proposed_for_rainfed_rotations():
    weather,solar=synthetic()
    report=build_decision_report(weather,solar,THERMAL)
    rice=next(c for c in report['ranked'] if c['crop_id']=='rice')
    assert rice['eligible_for_rainfed_plan'] is False
    assert 'inundado' in rice['eligibility_reason'].lower()
    assert all(c['crop_id']!='rice' for r in report['rotations'] for c in r['crops'])


def test_missing_february_29_never_filled_from_neighboring_day():
    weather,solar=synthetic()
    crop=next(c for c in CATALOG['crops'] if c['id']=='wheat')
    ref=next(c for c in THERMAL if c['id']=='wheat')
    rows={r['date']:r for r in weather if r['date'].startswith(('2018','2019'))}
    # Planning in 2028 includes Feb 29, but 2019 was not a leap year.
    assert _scenario_cycle(crop,ref,rows,2018,310,2027,-33) is None


def test_same_total_rain_different_stage_distribution_affects_water_screening():
    weather,solar=synthetic()
    crop=next(c for c in CATALOG['crops'] if c['id']=='wheat')
    ref=next(c for c in THERMAL if c['id']=='wheat')
    normal={r['date']:r for r in weather if r['date'].startswith('2020')}
    # 120 days × 3 mm: the same rain distributed through the crop cycle.
    steady=_scenario_cycle(crop,ref,normal,2020,0,2027,-33)
    concentrated={day:{**r,'precipitation_mm':12 if i<30 else 0}
                  for i,(day,r) in enumerate(normal.items())}
    uneven=_scenario_cycle(crop,ref,concentrated,2020,0,2027,-33)
    assert steady['rain_mm']==uneven['rain_mm']==360
    assert uneven['score_components_pct']['rainfed_water'] < steady['score_components_pct']['rainfed_water']
    assert uneven['water_weak_stage'] is not None


def test_historical_band_is_supported_by_actual_sample_count():
    weather, solar = synthetic()
    report = build_decision_report(weather, solar, THERMAL)
    for crop in report['ranked']:
        assert crop['history_sample_years'] >= 3
        assert crop['min_scenario_score'] <= crop['historical_p10_score']
        assert crop['historical_p10_score'] <= crop['historical_p90_score']
        assert crop['historical_p90_score'] <= 100



def test_long_climate_history_selection_does_not_throw_index_error():
    """Regression: 44 complete years used to trigger an IndexError / HTTP 500."""
    from decision_engine import selected_history_years, select_analogue_years, HISTORY_SAMPLE_MAX
    summaries = [
        {'year':year, 'eligible':True,
         'mean_temperature_c': 11 + (year-1981) * .15 + (year % 7)*.07,
         'rainfall_mm': 450 + (year % 11) * 21 + (year-1981)*3}
        for year in range(1981,2026)
    ]
    analogues = select_analogue_years(summaries,2025)
    selected = selected_history_years(summaries,2025,analogues)
    assert len(selected)==HISTORY_SAMPLE_MAX
    assert len(selected)==len(set(selected))
    assert selected==sorted(selected)
    assert all(year<2025 for year in selected)
    assert {a['year'] for a in analogues.values()}<=set(selected)
    assert {1981,2024}<=set(selected)


def test_full_historical_api_with_mocked_power_returns_200(monkeypatch):
    """End-to-end API test with many years and no actual NASA HTTP calls."""
    from fastapi.testclient import TestClient
    from app import app, earth_client
    from earth_observation_service import DAILY_WEATHER_PARAMETERS

    async def fake_daily(latitude, longitude, start, end, params, community, standard):
        if community=='HY':
            return []
        base=date(start.year,1,1)
        results=[]
        while base<=end:
            temperature=18+(base.year-1981)*.03
            row={'date':str(base)}
            if params==DAILY_WEATHER_PARAMETERS:
                row.update({'mean_c':temperature,'min_c':temperature-6,'max_c':temperature+9,
                            'precipitation_mm':2+(base.year % 7)*.2,
                            'wind_speed_ms':2.1,'dewpoint_c':11,'relative_humidity_pct':60,
                            'surface_pressure_kpa':101})
            else:
                row['solar_radiation_mj_m2_day']=17
            results.append(row)
            base+=timedelta(days=1)
        return results

    monkeypatch.setattr(earth_client,'daily',fake_daily)
    response=TestClient(app).post('/api/regions/decisions/history', json={'polygon':POLYGON})
    assert response.status_code==200, response.text[:1000]
    payload=response.json()
    assert payload['status']=='evaluated'
    assert len(payload['coverage']['sampled_years'])==12
    assert len(payload['ranked'])==10
