"""Fetch independent historic EO products and build explainable analogue decisions.

NASA POWER data are gridded estimates at a representative point. NDVI uses
Copernicus polygon mosaics solely as retrospective vegetation context; it is not
used to infer the species that will grow in a new planting.
"""
from __future__ import annotations

import asyncio
import calendar
from datetime import date
from collections import defaultdict

from decision_engine import build_decision_report, real, rnd
from earth_observation_service import DAILY_WEATHER_PARAMETERS, IMERG_PARAMETERS, SMAP_PARAMETERS
from region_service import describe_region

_LAST_COMPLETE_YEAR = date.today().year - 1  # Always the most recent complete calendar year.
_NDVI_EARLIEST_YEAR = 2017
_ndvi_limiter = asyncio.Semaphore(2)


async def historical_decision_climate(polygon, observations, thermal_catalog):
    region = describe_region(polygon)
    point = region['representative_point']
    lat, lon = point['latitude'], point['longitude']
    async def source(label, begin, params, community='AG', time_standard='LST'):
        try:
            data = await observations.daily(lat, lon, date(begin, 1, 1), date(_LAST_COMPLETE_YEAR, 12, 31), params, community, time_standard)
            return data, None
        except Exception as exc:
            return [], f'{label}: {type(exc).__name__}: {exc}'

    (weather, weather_error), (solar, solar_error), (soil, soil_error), (imerg, imerg_error) = await asyncio.gather(
        source('NASA POWER meteorología', 1981, DAILY_WEATHER_PARAMETERS),
        source('NASA POWER radiación', 1984, ('ALLSKY_SFC_SW_DWN',)),
        source('SMAP humedad del suelo', 2015, SMAP_PARAMETERS, 'HY', 'UTC'),
        source('GPM IMERG', 2000, IMERG_PARAMETERS, 'HY', 'UTC'),
    )
    year = date.today().year + 1
    report = build_decision_report(weather, solar, thermal_catalog, reference_year=_LAST_COMPLETE_YEAR, target_year=year,latitude=lat)
    # Solar, SMAP and IMERG are independent context. No fabricated crop suitability
    # rule is inferred from a variable whose crop-specific threshold is missing.
    report['region'] = region
    report['source_status'] = {
        'meteorology': {'source':'NASA POWER MET', 'start_year':1981, 'end_year':_LAST_COMPLETE_YEAR, 'error':weather_error,
                        'available':bool(weather), 'time_standard':'LST'},
        'radiation': {'source':'NASA POWER SOL', 'start_year':1984, 'end_year':_LAST_COMPLETE_YEAR, 'error':solar_error,
                      'available':any(real(x.get('solar_radiation_mj_m2_day')) for x in solar), 'time_standard':'LST'},
        'soil_moisture': {'source':'NASA POWER HY / SMAP', 'start_year':2015, 'end_year':_LAST_COMPLETE_YEAR, 'error':soil_error,
                          'available':any(real(x.get('rootzone_moisture_m3_m3')) for x in soil), 'time_standard':'UTC'},
        'gpm_precipitation': {'source':'NASA POWER HY / GPM IMERG', 'start_year':2000, 'end_year':_LAST_COMPLETE_YEAR,
                              'error':imerg_error, 'available':any(real(x.get('imerg_precipitation_mm')) for x in imerg),'time_standard':'UTC'},
    }
    # Optional historical products summarized instead of shipping decades of
    # daily data. Method/time difference retained; never used as interchangeable
    # rainfall or parcel soil-water measurement.
    for key, entries, field in (
        ('sm_rootzone',soil,'rootzone_moisture_m3_m3'),
        ('gpm',imerg,'imerg_precipitation_mm'),
    ):
        per_year=defaultdict(list)
        for row in entries:
            if real(row.get(field)):
                per_year[int(row['date'][:4])].append(row[field])
        report.setdefault('auxiliary_yearly',{})[key] = [{'year':y,'valid_days':len(v),
                       'mean':rnd(sum(v)/len(v),3), 'sum':rnd(sum(v)) if key=='gpm' else None}
                       for y,v in sorted(per_year.items())]
    return report


async def historical_ndvi_context(polygon, copernicus):
    if not copernicus.configured:
        return {'status':'unavailable','source':'Copernicus Sentinel-2 L2A',
                'reason':'Faltan credenciales OAuth; NDVI histórico no consultado.', 'annual':[]}
    async def one_year(year):
        async with _ndvi_limiter:
            try:
                data = await copernicus.statistics(polygon, date(year,1,1), date(year,12,31), 'P1M')
                valid=[r for r in data.get('observations',[]) if real(r.get('mean_ndvi'))]
                return {'year':year,'months_with_valid_ndvi':len(valid),
                        'ndvi_mean':rnd(sum(x['mean_ndvi'] for x in valid)/len(valid),4) if valid else None,
                        'status':'observed' if valid else 'no_valid_observations'}
            except Exception as exc:
                return {'year':year,'months_with_valid_ndvi':0,'ndvi_mean':None,
                        'status':'error','reason':f'{type(exc).__name__}: {exc}'}
    annual = await asyncio.gather(*(one_year(y) for y in range(_NDVI_EARLIEST_YEAR,_LAST_COMPLETE_YEAR+1)))
    return {'source':'Copernicus Sentinel-2 L2A','status':'partial' if any(x['status']=='error' for x in annual) else 'observed',
            'annual':annual,'year_range':[_NDVI_EARLIEST_YEAR,_LAST_COMPLETE_YEAR],
            'interpretation':'NDVI de la cobertura existente, no de un cultivo futuro; promedio de mosaicos mensuales, no predicción de rendimiento.',
            'geometry':'polígono seleccionado','clouds':'SCL 4/5 según configuración existente'}
