"""Explainable historical-analogue agronomic SCREENING for CropLite.

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
AGRONOMY = json.loads((Path(__file__).parent / 'data' / 'decision_agronomy_catalog.json').read_text(encoding='utf-8'))
FAMILIES = {key: item['family'] for key, item in AGRONOMY.items()}
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



# Scoring considers thermal suitability, heat accumulation, documented exposure,
# and potential rainfall adequacy for UNIRRIGATED systems. No hidden soil values.
WEIGHTS = {'temperature': .30, 'heat_accumulation': .25, 'exposure': .15, 'rainfed_water': .30}
HISTORY_SAMPLE_MAX = 12
ROTATION_YEARS = 1


def _mapped_annual_day(year, day_index):
    """Legacy helper used by older clients; no future climate is generated."""
    candidate = date(2025, 1, 1) + timedelta(days=day_index)
    return str(date(year, candidate.month, candidate.day)) if candidate.year == 2025 else None


def _stage_for_day(crop, position):
    accum = 0
    for stage in crop['stages']:
        accum += stage['duration_days']
        if position < accum:
            return stage
    return crop['stages'][-1]


def selected_history_years(summaries, reference_year, analogues=None):
    """Deterministic diversified sample, no artificial six-year limit.

    Includes climate extremes, typical year, beginning/recent years, and
    distributional quantiles. Annual completeness is checked separately.
    """
    eligible = [r for r in summaries if r['year'] < reference_year and r['eligible']]
    if len(eligible) <= HISTORY_SAMPLE_MAX:
        return [r['year'] for r in eligible]
    chosen = {item['year'] for item in (analogues or {}).values()}
    chosen.update((eligible[0]['year'], eligible[-1]['year']))
    for field in ('mean_temperature_c', 'rainfall_mm', 'year'):
        ordered = sorted(eligible, key=lambda r: r[field])
        for quantile in (.1, .25, .5, .75, .9):
            chosen.add(ordered[round((len(ordered)-1)*quantile)]['year'])
    if len(chosen) > HISTORY_SAMPLE_MAX:
        compulsory = {item['year'] for item in (analogues or {}).values()}
        compulsory.update((eligible[0]['year'], eligible[-1]['year']))
        ordered_extra = sorted(chosen-compulsory)
        # Compute indices against an immutable pool and a constant slot count.
        # Previously len(selected) changed inside the loop, eventually producing
        # an index outside ordered_extra and HTTP 500 on long NASA POWER series.
        slots = HISTORY_SAMPLE_MAX-len(compulsory)
        if slots > 0 and ordered_extra:
            if slots == 1:
                indices = [len(ordered_extra)//2]
            else:
                indices = [round(i*(len(ordered_extra)-1)/(slots-1))
                           for i in range(min(slots,len(ordered_extra)))]
            compulsory.update(ordered_extra[index] for index in indices)
        return sorted(compulsory)
    return sorted(chosen)


def _scenario_cycle(crop, thermal, by_date, year, sow_offset, target_year, latitude):
    """Evaluate an actual observed seasonal window, including a following year.

    The planned window is a hypothetical future calendar; the meteorology comes
    exclusively from recorded years, with matching month/day and adjacent years.
    """
    duration = crop['cycle_days']
    optimum = (thermal or {}).get('thermal', {}).get('optimumClimateC') or {}
    band = (optimum.get('min'), optimum.get('max'))
    gdd_base, gdd_upper = crop.get('gdd_base_c'), crop.get('gdd_upper_c')
    target_gdd = (crop.get('gdd_cycle_target_degree_days') or {}).get('min')
    # Some perennial crops (e.g. alfalfa) do not have a validated cycle-wide
    # GDD requirement in the source matrix. Do not exclude them or invent one:
    # evaluate the other documented dimensions and report GDD as unavailable.
    if not all(real(v) for v in (*band, gdd_base, gdd_upper)):
        return None
    has_gdd_target = real(target_gdd) and target_gdd > 0
    sow = date(target_year, 1, 1) + timedelta(days=sow_offset)
    harvest = sow + timedelta(days=duration-1)
    temp_days = rain_days = opt_days = 0
    gdd = precipitation = etc_sum = 0.0
    etc_days = cold_crossings = heat_crossings = 0
    cold_evaluable = heat_evaluable = 0
    vpd_values, radiation_values = [], []
    max_dry_spell = dry_spell = 0
    stage_rain=defaultdict(float)
    stage_etc=defaultdict(float)
    stage_etc_days=defaultdict(int)
    for i in range(duration):
        planned_date = sow + timedelta(days=i)
        historical_year = year + planned_date.year - target_year
        try:
            observed_date = date(historical_year, planned_date.month, planned_date.day)
        except ValueError:
            continue  # Feb 29 has no observed counterpart in some years.
        row = by_date.get(str(observed_date))
        if row is None: continue
        stage = _stage_for_day(crop, i)
        if real(row.get('mean_c')):
            temp_days += 1
            t = row['mean_c']
            opt_days += int(band[0] <= t <= band[1])
            gdd += max(0, min(t, gdd_upper) - gdd_base)
        if real(row.get('precipitation_mm')):
            rain_days += 1
            precipitation += max(0, row['precipitation_mm'])
            stage_rain[stage['id']]+=max(0,row['precipitation_mm'])
            dry_spell = dry_spell + 1 if row['precipitation_mm'] < 1.0 else 0
            max_dry_spell = max(max_dry_spell, dry_spell)
        vpd = row.get('_computed_vpd')
        if vpd is None:
            vpd = daily_vpd(row.get('max_c'), row.get('min_c'), row.get('dewpoint_c'))
        if real(vpd): vpd_values.append(vpd)
        radiation = row.get('solar_radiation_mj_m2_day')
        if real(radiation): radiation_values.append(radiation)
        eto = row.get('_computed_eto')
        if eto is None and '_computed_eto' not in row:
            eto = daily_eto(row.get('mean_c'),row.get('min_c'),row.get('max_c'),
                            row.get('dewpoint_c'),row.get('wind_speed_ms'),
                            row.get('surface_pressure_kpa'),radiation,latitude,observed_date.timetuple().tm_yday)
        if real(eto) and real(stage.get('kc')):
            etc_sum += eto*stage['kc']
            stage_etc[stage['id']]+=eto*stage['kc']
            stage_etc_days[stage['id']]+=1
            etc_days += 1
        cold = stage.get('cold_reference_c')
        if cold and real(cold.get('max_c')) and real(row.get('min_c')):
            cold_evaluable += 1
            cold_crossings += int(row['min_c'] <= cold['max_c'])
        heat = (thermal or {}).get('thermal', {}).get('heatReproductiveReferenceC')
        if stage['id'] == 'mid' and real(heat) and real(row.get('max_c')):
            heat_evaluable += 1
            heat_crossings += int(row['max_c'] >= heat)
    if temp_days / duration < .90 or rain_days != duration: return None  # Never interpolate absent daily rain, including leap days.
    thermal_fit = opt_days/temp_days
    completion_fit = min(gdd/target_gdd, 1.0) if has_gdd_target else None
    hazard_valid = cold_evaluable+heat_evaluable
    hazard_days = cold_crossings+heat_crossings
    hazard_fit = 1-hazard_days/hazard_valid if hazard_valid else None
    actual_etc = etc_sum if etc_days / duration >= .90 else None
    # If radiation is unavailable, compare rain with the user's documented
    # reference ETc range for this crop instead of inventing missing ET0.
    etc_reference = crop.get('etc_cycle_reference_mm') or {}
    valid_ref = [etc_reference.get('min'), etc_reference.get('max')]
    fallback_etc = mean(valid_ref) if all(real(v) and v>0 for v in valid_ref) else None
    water_benchmark = actual_etc if real(actual_etc) and actual_etc > 0 else fallback_etc
    rainfall_complete = rain_days == duration
    ratio = precipitation/water_benchmark if rainfall_complete and water_benchmark else None
    stage_water=[]
    if real(ratio) and crop['id'] != 'rice':
        # Compare rainfall distribution against documented phase-specific Kc.
        # It is an exploratory screening proxy, not a daily soil-water balance.
        stage_total_weight=sum(st['duration_days']*st['kc'] for st in crop['stages'] if real(st.get('kc')))
        for st in crop['stages']:
            phase_id=st['id']
            phase_etc=stage_etc.get(phase_id) if stage_etc_days[phase_id] >= .9*st['duration_days'] else None
            if not real(phase_etc):
                phase_etc=water_benchmark*st['duration_days']*st['kc']/stage_total_weight if stage_total_weight and real(st.get('kc')) else None
            if real(phase_etc) and phase_etc>0:
                stage_water.append({'stage':phase_id,'label':st['label'],
                                    'rain_mm':rnd(stage_rain[phase_id],1),
                                    'demand_mm':rnd(phase_etc,1),
                                    'rain_to_demand':rnd(stage_rain[phase_id]/phase_etc,2)})
    weak_stage=min(stage_water,key=lambda x:x['rain_to_demand']) if len(stage_water)==len(crop['stages']) else None
    water_fit=(.7*min(1,ratio)+.3*min(1,weak_stage['rain_to_demand'])) if weak_stage else (min(1,ratio) if real(ratio) else None)
    # If phase Kc is absent, use only the whole-cycle rainfall/ETc reference.
    # The score reflects reduced evidence, not a fictitious stage value.
    dimensions = {
        'temperature': thermal_fit,
        'heat_accumulation': completion_fit,
        'exposure': hazard_fit,
        'rainfed_water': water_fit,
    }
    available = [(v,WEIGHTS[k]) for k,v in dimensions.items() if real(v)]
    score = round(100*sum(value*weight for value,weight in available)/sum(weight for _,weight in available),1)
    return {
        'score':score, 'score_components_pct':{k:rnd(100*v,1) if real(v) else None for k,v in dimensions.items()},
        'score_weights':{k:WEIGHTS[k] for k,v in dimensions.items() if real(v)},
        'thermal_fit_pct':rnd(thermal_fit*100,1),'gdd_fit_pct':rnd(completion_fit*100,1) if has_gdd_target else None,
        'gdd_sum':rnd(gdd,1),'gdd_target_min':target_gdd if has_gdd_target else None,
        'criteria':{
            'survival_exposure':{'status':'not_evaluable' if not hazard_valid else 'reference_crossed' if hazard_days else 'no_reference_crossing',
                'reference_crossing_days':hazard_days if hazard_valid else None,'evaluated_days':hazard_valid,
                'note':'Exposición a referencias térmicas del catálogo; no es daño observado.'},
            'development_temperature':{'status':'observed_compatibility','in_band_fraction':rnd(thermal_fit,3)},
            'cycle_thermal_completion':{'status':'estimated_gdd' if has_gdd_target else 'not_evaluable','gdd_fraction':rnd(completion_fit,3) if has_gdd_target else None},
            'rainfed_water':{'status':'estimated' if real(water_fit) else 'not_evaluable',
                'water_fit_fraction':rnd(water_fit,3), 'note':'Precipitación frente a demanda teórica en secano; no hay balance de humedad del suelo.'},
        },
        'cold_reference_crossings':cold_crossings if cold_evaluable else None,
        'heat_reference_crossings':heat_crossings if heat_evaluable else None,
        'hazard_days_evaluated':hazard_valid,
        'rain_mm':rnd(precipitation) if rainfall_complete else None,
        'etc_mm':rnd(actual_etc), 'etc_source':'FAO-56 ETo×Kc' if real(actual_etc) else 'Rango de ETc por ciclo (Excel)',
        'water_benchmark_mm':rnd(water_benchmark),'rain_etc_ratio':rnd(ratio,2),
        'max_dry_spell_days':max_dry_spell if rainfall_complete else None,
        'stage_water_context':stage_water,
        'water_weak_stage':weak_stage['label'] if weak_stage else None,
        'vpd_mean_kpa':rnd(avg(vpd_values)), 'solar_radiation_mean_mj_m2_day':rnd(avg(radiation_values)),
        'solar_radiation_coverage':rnd(len(radiation_values)/duration,3),
        'etc_coverage':rnd(etc_days/duration,3), 'rain_coverage':rnd(rain_days/duration,3),
        'temperature_coverage':rnd(temp_days/duration,3),
        'sow_date':str(sow),'harvest_date':str(harvest),'duration_days':duration,'sow_day_offset':sow_offset,
    }


def _rotations(candidate_by_crop, planning_year):
    """Plan consecutive, non-overlapping crops WITHIN ONE calendar year.

    Offer at most three two-crop sequences. Each crop must be fully planted and
    harvested inside the same planning year, with a minimum 14-day transition
    and different adjacent botanical families. This is a scheduling comparison,
    NOT proof of agronomic benefits, nutrient restoration, or a future forecast.
    """
    # Keep diverse planting windows rather than only the crop's top-scoring date.
    # Catalog cycles are generic; these windows remain hypothetical.
    options=[]
    for entries in candidate_by_crop.values():
        picked=[]
        for item in sorted(entries,key=lambda x:(-x['score'],x['sow_day_offset'])):
            if all(abs(item['sow_day_offset']-prev['sow_day_offset'])>=28 for prev in picked):
                picked.append(item)
            if len(picked)==7:break
        options.extend(picked)

    end_of_year=date(planning_year,12,31)
    by_start=[]
    for candidate in options:
        sow=date.fromisoformat(candidate['sow_date'])
        # Scenarios have dates in the target year; discard next-year harvests.
        harvest=sow+timedelta(days=candidate['cycle_days']-1)
        if sow.year != planning_year or harvest > end_of_year:
            continue
        by_start.append({**candidate,'sow_date':str(sow),'harvest_date':str(harvest),
                         'planning_year':planning_year})
    by_start.sort(key=lambda x:(x['sow_date'],-x['score']))

    plans=[]
    for first in by_start:
        first_end=date.fromisoformat(first['harvest_date'])
        for second in by_start:
            if first['crop_id']==second['crop_id'] or first['family']==second['family']:
                continue
            gap=(date.fromisoformat(second['sow_date'])-first_end).days-1
            if gap < TRANSITION_DAYS:
                continue
            duo=[first,second]
            scores=[x['score'] for x in duo]
            root=[(AGRONOMY.get(x['crop_id']) or {}).get('root_depth_m',{}).get('max') for x in duo]
            root_contrast=int(all(real(x) for x in root) and abs(root[0]-root[1])>=.4)
            # Combine the weaker crop and the average to avoid masking poor fit.
            score=rnd(.5*min(scores)+.5*mean(scores),1)
            plans.append({
                'id':f"{first['crop_id']}-{second['crop_id']}-{planning_year}-{first['sow_day_offset']}-{second['sow_day_offset']}",
                'crops':duo,'score':score,'gap_days':[gap],
                'years':[planning_year], 'families_count':2,
                'root_contrast_count':root_contrast,
                'legume_present':any(x['family']=='Fabaceae' for x in duo),
                'species_count':2,
                'basis':'Dos cultivos sucesivos dentro del mismo año calendario, con distinta familia y sin solapamientos.',
                'reasons':[
                    f"Ambos ciclos de siembra y cosecha caben en {planning_year}, sin cruzar al año siguiente.",
                    f"Se alternan las familias {first['family']} y {second['family']}.",
                    f"Hay {gap} días entre cosecha y siguiente siembra (mínimo supuesto: {TRANSITION_DAYS}).",
                    'La diversidad de raíces es orientativa; no se han medido los efectos sobre el suelo.'
                ]
            })
    # Distinct crop orders; avoid a list of duplicates differing only in weeks.
    plans.sort(key=lambda p:(-p['score'],-int(p['legume_present']),-p['root_contrast_count'],p['id']))
    selected=[];seen=set()
    for plan in plans:
        key=tuple(c['crop_id'] for c in plan['crops'])
        if key in seen:continue
        seen.add(key)
        selected.append(plan)
        if len(selected)==3:break
    return selected


def rank_crops(rows, solar_rows, scenarios, thermal_catalog, target_year, latitude, *, evaluation_years=None):
    if not scenarios: return [],[]
    thermal_by_id={c['id']:c for c in thermal_catalog}
    years=list(dict.fromkeys(evaluation_years or [x['year'] for x in scenarios.values()]))
    # Never modify the raw POWER records in place; benchmark simulations are pure.
    observed={row['date']:dict(row) for row in rows if len(row.get('date',''))==10 and int(row['date'][:4])<=max(years)}
    for row in solar_rows:
        key=row.get('date')
        if key in observed and real(row.get('solar_radiation_mj_m2_day')):
            observed[key]['solar_radiation_mj_m2_day']=row['solar_radiation_mj_m2_day']
    # ETo is expensive; compute once per observed day, not per crop/window.
    for key,row in observed.items():
        radiation=row.get('solar_radiation_mj_m2_day')
        day=date.fromisoformat(key)
        row['_computed_eto']=daily_eto(row.get('mean_c'),row.get('min_c'),row.get('max_c'),
                                       row.get('dewpoint_c'),row.get('wind_speed_ms'),
                                       row.get('surface_pressure_kpa'),radiation,latitude,day.timetuple().tm_yday) if real(radiation) else None
        row['_computed_vpd']=daily_vpd(row.get('max_c'),row.get('min_c'),row.get('dewpoint_c'))
    result=[];pool=defaultdict(list)
    for crop in CATALOG['crops']:
        best=None
        for offset in range(0,365,SOW_INTERVAL_DAYS):
            per_year={}
            for year in years:
                evaluated=_scenario_cycle(crop,thermal_by_id.get(crop['id']),observed,year,offset,target_year,latitude)
                if evaluated:per_year[year]=evaluated
            if len(per_year)<max(3,math.ceil(.8*len(years))):continue
            values=[v['score'] for v in per_year.values()]
            robust=rnd(.6*percentile(values,.25)+.4*mean(values),1)
            scenario_results={label:per_year.get(meta['year']) for label,meta in scenarios.items()}
            scenario_results={key:value for key,value in scenario_results.items() if value}
            # Summaries for the user are calculated across ALL valid sample years.
            water_values=[r['score_components_pct']['rainfed_water'] for r in per_year.values()
                          if real(r['score_components_pct']['rainfed_water'])]
            candidate={
                'crop_id':crop['id'],'crop_name':crop['name'],'family':FAMILIES[crop['id']],
                'score':robust,'scenario_results':scenario_results,
                'sow_date':next(iter(per_year.values()))['sow_date'],
                'harvest_date':next(iter(per_year.values()))['harvest_date'],
                'sow_day_offset':offset,'cycle_days':crop['cycle_days'],
                'min_scenario_score':min(values),'mean_scenario_score':rnd(mean(values),1),
                'history_sample_years':len(per_year),'history_years_considered':len(years),
                'historical_p25_score':rnd(percentile(values,.25),1),
                'historical_p10_score':rnd(percentile(values,.1),1),
                'historical_p90_score':rnd(percentile(values,.9),1),
                'water_fit_pct':rnd(avg(water_values),1),
                'water_weak_stage':next((v['water_weak_stage'] for v in per_year.values() if v.get('water_weak_stage')),None),
                'water_context_available':bool(water_values),
                'eligible_for_rainfed_plan':crop['id'] != 'rice',
                'eligibility_reason':'Arroz inundado: requiere abastecimiento y manejo hídrico, no evaluables como secano.' if crop['id']=='rice' else None,
                'rain_vs_water_demand_basis':('Proxy solo del ciclo completo cuando faltan Kc por etapa; sin balance edáfico.' if crop['id']=='alfalfa-heno' else '70 % del ajuste lluvia/ETc por ciclo y 30 % del ajuste de la etapa con menor relación lluvia/ETc (Kc por etapa). Proxy en secano sin balance edáfico.'),
                'not_evaluated':['Disponibilidad real de riego','pH y nutrientes de la parcela','Sanidad, variedad y manejo'],
                'basis':'Compatibilidad térmica, GDD, exposición condicional y agua de lluvia frente a demanda teórica; índice relativo de secano.'
            }
            if crop['id'] != 'rice':pool[crop['id']].append(candidate)
            if best is None or candidate['score']>best['score']:best=candidate
        if best:result.append(best)
    result.sort(key=lambda r:(not r['eligible_for_rainfed_plan'],-r['score'],r['crop_name']))
    return result,_rotations(pool,target_year)


def build_decision_report(weather_rows,solar_rows,thermal_catalog,*,reference_year=2025,target_year=2027,latitude=-33.05):
    years=sorted({int(r['date'][:4]) for r in weather_rows if len(r.get('date',''))==10})
    summary=[year_summary(weather_rows,yr) for yr in years if yr<=reference_year]
    analogues=select_analogue_years(summary,reference_year)
    ref=next((r for r in summary if r['year']==reference_year),None)
    historical=[r for r in summary if r['year']<reference_year and r['eligible']]
    baseline_temp=avg([r['mean_temperature_c'] for r in historical]);baseline_rain=avg([r['rainfall_mm'] for r in historical])
    recent={'year':reference_year,'available':bool(ref and ref['eligible']),
            'mean_temp_c':ref['mean_temperature_c'] if ref else None,
            'rainfall_mm':ref['rainfall_mm'] if ref else None,
            'temperature_difference_vs_history_c':rnd(ref['mean_temperature_c']-baseline_temp) if ref and ref['eligible'] and real(baseline_temp) else None,
            'rain_difference_vs_history_mm':rnd(ref['rainfall_mm']-baseline_rain) if ref and ref['eligible'] and real(baseline_rain) else None}
    selected=[r['year'] for r in historical]
    evaluation_years=selected_history_years(summary,reference_year,analogues)
    ranked,rotations=rank_crops(weather_rows,solar_rows,analogues,thermal_catalog,target_year,latitude,
                                evaluation_years=evaluation_years) if analogues else ([],[])
    solar_years={int(r['date'][:4]) for r in solar_rows if real(r.get('solar_radiation_mj_m2_day'))}
    return {
        'status':'evaluated' if ranked else 'insufficient',
        'method':'historical_climate_quantile_sampling_and_rainfed_suitability_v3',
        'is_trained_ml':False,'is_weather_forecast':False,'is_yield_prediction':False,
        'reference_year':reference_year,'planning_year':target_year,'planning_years':[target_year+i for i in range(ROTATION_YEARS)],
        'coverage':{'met_years_received':len(summary),'baseline_valid_years':len(historical),
                    'baseline_first':min(selected) if selected else None,'baseline_last':max(selected) if selected else None,
                    'sampled_years':evaluation_years,'solar_years_with_data':len(solar_years),
                    'ndvi_handling':'NDVI del polígono como contexto: no identifica productividad de cultivos futuros'},
        'recent_comparison':recent,'annual_summary':summary,
        'seasonal_profile':month_profile(weather_rows,set(selected)),
        'recent_monthly':month_profile(weather_rows,{reference_year}),
        'analogues':analogues or {},'ranked':ranked,'rotations':rotations,
        'decision_dimensions':['Temperatura','Calor acumulado','Exposición térmica (si existe referencia)','Lluvia frente a ETc en secano'],
        'planning_assumptions':{'rainfed':True,'soil_measured':False,'irrigation_confirmed':False,
                                'years':ROTATION_YEARS,'transition_days':TRANSITION_DAYS,
                                'family_change_between_seasons':True,'distinct_crop_species_in_same_year':True,
                                'stages':'duraciones aproximadas del catálogo, no simulación dinámica de madurez'},
        'limitations':[
            'El próximo año agrícola se planifica con ciclos completos dentro del mismo año calendario; no es un pronóstico meteorológico.',
            'La compatibilidad hídrica supone secano: 70 % lluvia/ETc del ciclo + 30 % peor etapa Kc. No equivale a estrés hídrico ni conoce infiltración, riego o reservas del suelo.',
            'Se utilizan hasta doce años históricos elegidos con criterios climáticos y temporales; no una probabilidad de rendimiento.',
            'La evaluación individual puede mostrar ciclos que cruzan de año; el plan de rotación anual excluye esos cruces.',
            'El motor NO puntúa pH, nutrientes, VPD o radiación sin referencias comparables y datos locales verificables.',
            'Las referencias diarias de frío/calor y las duraciones fenológicas no equivalen a pérdidas ni cosechas reales.',
            'La alternancia de familias, las especies distintas, profundidad radicular y espacio entre campañas son criterios de planificación, no garantía de recuperación del suelo.'
        ]}
