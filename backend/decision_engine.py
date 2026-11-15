"""Explainable historical-analogue agronomic SCREENING for TerraAI.

NO trained ML, NO probability of survival, NO yield model. Scenario years are
observed climate analogues; projected dates are planning examples, not forecasts.
"""
from __future__ import annotations

import calendar
import json
import math
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import mean, median
from daily2025_service import daily_eto, daily_vpd

CATALOG = json.loads((Path(__file__).parent / 'data' / 'decision_crop_catalog.json').read_text(encoding='utf-8'))
FAMILIES = {'wheat': 'Poaceae', 'maize': 'Poaceae', 'rice': 'Poaceae', 'soybean': 'Fabaceae',
            'sorghum': 'Poaceae', 'barley': 'Poaceae'}
VALID_THRESHOLD = .95
SOW_INTERVAL_DAYS = 14
TRANSITION_DAYS = 14


def real(value):
    return type(value) in (float, int) and math.isfinite(value)


def avg(rows):
    return mean(rows) if rows else None


def rnd(value, digits=2):
    return round(value, digits) if real(value) else None


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    pos = (len(ordered) - 1) * fraction
    low = int(math.floor(pos))
    high = int(math.ceil(pos))
    return ordered[low] * (high - pos) + ordered[high] * (pos - low) if high != low else ordered[low]


def year_summary(rows, year):
    subset = [r for r in rows if str(r.get('date', '')).startswith(str(year) + '-')]
    n = 366 if calendar.isleap(year) else 365
    temperatures = [r['mean_c'] for r in subset if real(r.get('mean_c'))]
    rain = [r['precipitation_mm'] for r in subset if real(r.get('precipitation_mm'))]
    return {
        'year': year, 'days': n, 'temperature_days': len(temperatures), 'rain_days': len(rain),
        'temperature_coverage': rnd(len(temperatures) / n, 3),
        'rain_coverage': rnd(len(rain) / n, 3),
        'mean_temperature_c': rnd(avg(temperatures)),
        'rainfall_mm': rnd(sum(rain)) if len(rain) == n else None,
        'eligible': len(temperatures) >= n * VALID_THRESHOLD and len(rain) == n,
    }


def select_analogue_years(summaries, baseline_year=2025):
    eligible = [r for r in summaries if r['year'] < baseline_year and r['eligible']]
    if len(eligible) < 3:
        return None
    baseline_temp = median(r['mean_temperature_c'] for r in eligible)
    baseline_rain = median(r['rainfall_mm'] for r in eligible)
    temp_spread = max(1.0, percentile([r['mean_temperature_c'] for r in eligible], .9) -
                           percentile([r['mean_temperature_c'] for r in eligible], .1))
    rain_spread = max(1.0, percentile([r['rainfall_mm'] for r in eligible], .9) -
                           percentile([r['rainfall_mm'] for r in eligible], .1))
    typical = min(eligible, key=lambda r: (abs(r['mean_temperature_c'] - baseline_temp) / temp_spread +
                     abs(r['rainfall_mm'] - baseline_rain) / rain_spread, -r['year']))
    # Choose observed analogues, not synthetic combinations of uncorrelated conditions.
    warm = max(eligible, key=lambda r: (r['mean_temperature_c'], r['year']))
    dry = min(eligible, key=lambda r: (r['rainfall_mm'], -r['year']))
    return {
        'typical': {'year': typical['year'], 'label': 'Temporada histórica habitual', 'basis': 'Año real más próximo a las medianas históricas de temperatura y lluvia'},
        'warm': {'year': warm['year'], 'label': 'Temporada histórica cálida', 'basis': 'Año real con mayor temperatura media anual, entre los completos'},
        'dry': {'year': dry['year'], 'label': 'Temporada histórica seca', 'basis': 'Año real con menor precipitación anual, entre los completos'},
    }


def month_profile(rows, years):
    # Separately report actual monthly interannual variation; a month with poor
    # coverage is not allowed to change the climatology silently.
    monthly = defaultdict(list)
    by_year_month = defaultdict(list)
    for row in rows:
        key = row.get('date', '')
        if len(key) != 10:
            continue
        year, month = int(key[:4]), int(key[5:7])
        if year in years:
            by_year_month[(year, month)].append(row)
    for (year, month), entries in by_year_month.items():
        n = calendar.monthrange(year, month)[1]
        ts = [r['mean_c'] for r in entries if real(r.get('mean_c'))]
        ps = [r['precipitation_mm'] for r in entries if real(r.get('precipitation_mm'))]
        if len(ts) / n >= .9 and len(ps) == n:
            monthly[month].append({'temp': mean(ts), 'rain': sum(ps)})
    return [{'month': m, 'sample_years': len(monthly[m]),
             'temp_mean_c': rnd(avg([x['temp'] for x in monthly[m]])),
             'temp_p10_c': rnd(percentile([x['temp'] for x in monthly[m]], .1)),
             'temp_p90_c': rnd(percentile([x['temp'] for x in monthly[m]], .9)),
             'rain_median_mm': rnd(median([x['rain'] for x in monthly[m]])) if monthly[m] else None,
             'rain_p10_mm': rnd(percentile([x['rain'] for x in monthly[m]], .1)),
             'rain_p90_mm': rnd(percentile([x['rain'] for x in monthly[m]], .9)),
             } for m in range(1, 13)]


def _mapped_annual_day(year, day_index):
    """Use month/day against actual analog year; don't invent leap-day observations."""
    reference = date(2025, 1, 1) + timedelta(days=day_index)
    if reference.year != 2025:
        return None
    return f'{year}-{reference.month:02d}-{reference.day:02d}'


def _stage_for_day(crop, position):
    accum = 0
    for stage in crop['stages']:
        accum += stage['duration_days']
        if position < accum:
            return stage
    return crop['stages'][-1]


def _scenario_cycle(crop, thermal, by_date, year, sow_offset, target_year, latitude):
    duration = crop['cycle_days']
    if sow_offset + duration > 365:
        return None
    optimum = (thermal or {}).get('thermal', {}).get('optimumClimateC') or {}
    band = optimum.get('min'), optimum.get('max')
    if not all(real(v) for v in band):
        return None
    gdd_base, gdd_upper = crop.get('gdd_base_c'), crop.get('gdd_upper_c')
    target_gdd = (crop.get('gdd_cycle_target_degree_days') or {}).get('min')
    if not all(real(v) for v in (gdd_base, gdd_upper, target_gdd)) or target_gdd <= 0:
        return None
    temp_days = 0
    rain_days = 0
    opt_days = 0
    gdd = 0
    precipitation = 0
    etc_sum = 0
    etc_days = 0
    vpd_values = []
    radiation_values = []
    cold_evaluable = 0
    cold_crossings = 0
    heat_evaluable = 0
    heat_crossings = 0
    for i in range(duration):
        key = _mapped_annual_day(year, sow_offset+i)
        row = by_date.get(key) if key else None
        if not row:
            continue
        stage = _stage_for_day(crop, i)
        if real(row.get('mean_c')):
            temp_days += 1
            t = row['mean_c']
            opt_days += (band[0] <= t <= band[1])
            gdd += max(0, min(t, gdd_upper) - gdd_base)
        if real(row.get('precipitation_mm')):
            rain_days += 1
            precipitation += row['precipitation_mm']
        vpd = daily_vpd(row.get('max_c'),row.get('min_c'),row.get('dewpoint_c'))
        if real(vpd):
            vpd_values.append(vpd)
        radiation = row.get('solar_radiation_mj_m2_day')
        if real(radiation):
            radiation_values.append(radiation)
        date_key = date.fromisoformat(key)
        eto = daily_eto(row.get('mean_c'), row.get('min_c'), row.get('max_c'),
                        row.get('dewpoint_c'), row.get('wind_speed_ms'),
                        row.get('surface_pressure_kpa'), radiation, latitude, date_key.timetuple().tm_yday)
        if real(eto) and real(stage.get('kc')):
            etc_sum += eto * stage['kc']
            etc_days += 1
        cold = stage.get('cold_reference_c')
        if cold and real(cold.get('max_c')) and real(row.get('min_c')):
            cold_evaluable += 1
            cold_crossings += (row['min_c'] <= cold['max_c'])
        heat = (thermal or {}).get('thermal', {}).get('heatReproductiveReferenceC')
        if stage['id'] == 'mid' and real(heat) and real(row.get('max_c')):
            heat_evaluable += 1
            heat_crossings += (row['max_c'] >= heat)
    cover = temp_days / duration
    if cover < .9:
        return None
    # Three explicitly separate criteria. Hazard comparison applies only to
    # documented cold stages and the broad reproductive mid-stage proxy.
    thermal_fit = opt_days / temp_days
    completion_fit = min(gdd / target_gdd, 1)
    hazard_days = cold_crossings + heat_crossings
    hazard_valid = cold_evaluable + heat_evaluable
    hazard_fit = 1 - hazard_days / hazard_valid if hazard_valid else None
    dimensions = [(thermal_fit, .45), (completion_fit, .4)]
    if hazard_fit is not None:
        dimensions.append((hazard_fit, .15))
    score = round(100 * sum(v*w for v, w in dimensions)/sum(w for _, w in dimensions))
    base = date(target_year, 1, 1)
    sow = base+timedelta(days=sow_offset)
    harvest = sow+timedelta(days=duration-1)
    return {
        'score': score,
        'criteria':{
            'survival_exposure': {'status':('not_evaluable' if not hazard_valid else 'reference_crossed' if hazard_days else 'no_reference_crossing'),
                                  'reference_crossing_days':hazard_days if hazard_valid else None,
                                  'evaluated_days':hazard_valid,
                                  'note':'Cruces de referencias por etapa; NO se infiere supervivencia o daño real.'},
            'development_temperature': {'status':'observed_compatibility', 'in_band_fraction':rnd(thermal_fit,3),
                                        'note':'Coincidencia de T media con banda climática orientativa, NO salud observada.'},
            'cycle_thermal_completion':{'status':'estimated_gdd','gdd_fraction':rnd(completion_fit,3),
                                        'note':'Progreso de GDD frente a requisito mínimo, no maduración observada.'},
        },
        'thermal_fit_pct': rnd(100*thermal_fit,1),
        'gdd_fit_pct': rnd(100*completion_fit,1), 'gdd_sum': rnd(gdd,1), 'gdd_target_min': target_gdd,
        'cold_reference_crossings': cold_crossings if cold_evaluable else None,
        'heat_reference_crossings': heat_crossings if heat_evaluable else None,
        'hazard_days_evaluated': hazard_valid,
        'rain_mm': rnd(precipitation) if rain_days == duration else None,
        'etc_mm': rnd(etc_sum) if etc_days / duration >= .9 else None,
        'rain_etc_ratio': rnd(precipitation / etc_sum, 2) if rain_days == duration and etc_days==duration and etc_sum > 0 else None,
        'vpd_mean_kpa': rnd(avg(vpd_values)),
        'solar_radiation_mean_mj_m2_day': rnd(avg(radiation_values)),
        'solar_radiation_coverage': rnd(len(radiation_values)/duration,3),
        'etc_coverage':rnd(etc_days/duration,3),
        'rain_coverage': rnd(rain_days / duration,3), 'temperature_coverage': rnd(cover,3),
        'sow_date': str(sow), 'harvest_date': str(harvest), 'duration_days': duration,
        'sow_day_offset': sow_offset,
    }


def rank_crops(rows, solar_rows, scenarios, thermal_catalog, target_year, latitude):
    by_year = defaultdict(dict)
    for r in rows:
        key = r.get('date', '')
        if len(key) == 10:
            by_year[int(key[:4])][key] = r
    thermal_by_id = {c['id']: c for c in thermal_catalog}
    for row in solar_rows:
        item = by_year.get(int(row['date'][:4]),{}).get(row['date'])
        if item is not None and real(row.get('solar_radiation_mj_m2_day')):
            item['solar_radiation_mj_m2_day'] = row['solar_radiation_mj_m2_day']
    scenario_years = {key: meta['year'] for key, meta in scenarios.items()}
    result, plan_pool = [], []
    for crop in CATALOG['crops']:
        best = None
        for offset in range(0, 365 - crop['cycle_days'] + 1, SOW_INTERVAL_DAYS):
            per_scenario = {}
            for label, yr in scenario_years.items():
                evaluated = _scenario_cycle(crop, thermal_by_id.get(crop['id']), by_year[yr], yr, offset, target_year, latitude)
                if evaluated:
                    per_scenario[label] = evaluated
            if len(per_scenario) < len(scenarios):
                continue  # A missing scenario is never silently counted as favorable.
            values = [v['score'] for v in per_scenario.values()]
            robust = rnd(.6*min(values) + .4*mean(values),1)
            candidate = {'crop_id':crop['id'], 'crop_name':crop['name'], 'family':FAMILIES[crop['id']],
                         'score':robust, 'scenario_results':per_scenario,
                         'sow_date':next(iter(per_scenario.values()))['sow_date'],
                         'harvest_date':next(iter(per_scenario.values()))['harvest_date'],
                         'cycle_days':crop['cycle_days'], 'min_scenario_score':min(values),
                         'mean_scenario_score':rnd(mean(values),1),
                         'not_evaluated':['Producción/rendimiento', 'Disponibilidad real de riego',
                                          'pH, nutrientes, textura y fertilidad de la parcela',
                                          'Sanidad vegetal, variedad y manejo del cultivo'],
                         'basis': 'Índice de compatibilidad térmica y GDD con referencias condicionales; no probabilidad de cosecha'}
            plan_pool.append(candidate)
            if best is None or candidate['score'] > best['score']:
                best = candidate
        if best:
            result.append(best)
    result.sort(key=lambda r:(-r['score'],r['crop_name']))
    rotations=[]
    for first in plan_pool:
        for second in plan_pool:
            if first['family']==second['family'] or first['crop_id']==second['crop_id']:
                continue
            if date.fromisoformat(second['sow_date']) <= date.fromisoformat(first['harvest_date']) + timedelta(days=TRANSITION_DAYS):
                continue
            mean_score = rnd(.6*min(first['score'],second['score'])+.4*mean([first['score'],second['score']]),1)
            rotations.append({'id':f"{first['crop_id']}-{first['sow_date']}-{second['crop_id']}-{second['sow_date']}",
                              'crops':[first,second], 'score':mean_score,
                              'gap_days':(date.fromisoformat(second['sow_date'])-date.fromisoformat(first['harvest_date'])).days-1,
                              'basis':'Familias distintas, calendario compatible y puntuación térmica robusta; no certifica viabilidad de rotación'})
    rotations.sort(key=lambda row:(-row['score'],row['id']))
    # Prefer distinct combinations; multiple dates of same two crops are not 3 independent alternatives.
    unique=[]; seen=set()
    for item in rotations:
        pair=tuple(c['crop_id'] for c in item['crops'])
        if pair in seen:continue
        seen.add(pair);unique.append(item)
        if len(unique)==3:break
    return result, unique


def build_decision_report(weather_rows, solar_rows, thermal_catalog, *, reference_year=2025, target_year=2027, latitude=-33.05):
    years=sorted({int(r['date'][:4]) for r in weather_rows if len(r.get('date',''))==10})
    summary=[year_summary(weather_rows, yr) for yr in years if yr<=reference_year]
    analogues=select_analogue_years(summary, reference_year)
    ref=next((r for r in summary if r['year']==reference_year),None)
    historical=[r for r in summary if r['year']<reference_year and r['eligible']]
    baseline_temp=avg([r['mean_temperature_c'] for r in historical])
    baseline_rain=avg([r['rainfall_mm'] for r in historical])
    recent={'year':reference_year,'available':bool(ref and ref['eligible']),
            'mean_temp_c':ref['mean_temperature_c'] if ref else None,
            'rainfall_mm':ref['rainfall_mm'] if ref else None,
            'temperature_difference_vs_history_c':rnd(ref['mean_temperature_c']-baseline_temp) if ref and ref['eligible'] and real(baseline_temp) else None,
            'rain_difference_vs_history_mm':rnd(ref['rainfall_mm']-baseline_rain) if ref and ref['eligible'] and real(baseline_rain) else None}
    selected = [r['year'] for r in historical]
    ranked, rotations = rank_crops(weather_rows,solar_rows,analogues,thermal_catalog,target_year,latitude) if analogues else ([],[])
    annual_solar={}
    for r in solar_rows:
        year = int(r['date'][:4])
        if real(r.get('solar_radiation_mj_m2_day')):
            annual_solar.setdefault(year,[]).append(r['solar_radiation_mj_m2_day'])
    return {
        'status':'evaluated' if ranked else 'insufficient',
        'method':'observed_year_analogues_and_explainable_agronomic_rules_v2',
        'is_trained_ml':False,'is_weather_forecast':False,'is_yield_prediction':False,
        'reference_year':reference_year,'planning_year':target_year,
        'coverage':{'met_years_received':len(summary),'baseline_valid_years':len(historical),
                    'baseline_first':min(selected) if selected else None,
                    'baseline_last':max(selected) if selected else None,
                    'solar_years_with_data':len(annual_solar),
                    'ndvi_handling':'Sentinel-2 polígono: contexto independiente, no identifica especie ni productividad futura'},
        'recent_comparison':recent, 'annual_summary':summary,
        'seasonal_profile':month_profile(weather_rows,set(selected)),
        'recent_monthly':month_profile(weather_rows,{reference_year}),
        'analogues':analogues or {}, 'ranked':ranked, 'rotations':rotations,
        'limitations':[
            'Analogías de años observados: no son predicciones del clima futuro.',
            'Se optimizan fechas dentro de un año calendario; ciclos que cruzan diciembre se excluyen en esta versión.',
            'La puntuación es relativa y fundamentalmente térmica/GDD. El agua es descriptiva: sin riego, escorrentía y suelo no se infiere estrés hídrico.',
            'Los umbrales de frío y calor aplican solo a fases aproximadas FAO; cruzarlos no confirma daño.',
            'La fecha fenológica se aproxima por días fijos, no observación directa; el NDVI observado puede pertenecer a otro cultivo.',
            'Las secuencias de familias distintas no garantizan beneficios sanitarios ni aptitud del suelo.',
            'Datos climáticos regionales de NASA POWER, no mediciones dentro de la parcela.',
            'No hay etiquetas independientes de rendimiento ni validación geográfica para entrenar IA; metodología de reglas transparente.'
        ]}
