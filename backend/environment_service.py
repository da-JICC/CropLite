"""Multi-source environmental time series: monthly records and seasonal profiles.

Each data source keeps its own actual time coverage and units. There is no
extrapolation or crop suitability prediction in this stage.
"""
from __future__ import annotations

import asyncio
import calendar
from collections import defaultdict
from datetime import date
from statistics import mean

from historical_service import valid_number
from region_service import describe_region
from earth_observation_service import WEATHER_PARAMETERS, IMERG_PARAMETERS, SMAP_PARAMETERS

# Data availability dates are conservative, not backend request-size limits.
METEOROLOGY_START = date(1981, 1, 1)
SOLAR_START = date(1984, 1, 1)
SENTINEL_START = date(2017, 1, 1)
IMERG_START = date(1998, 6, 1)
SMAP_START = date(2015, 4, 1)
_COPERNICUS_LIMIT = asyncio.Semaphore(2)

VARIABLES = {
    'temperature': {'source': 'NASA POWER · meteorología (reanálisis)', 'unit': '°C', 'aggregation': 'mean', 'key': 'mean_c', 'other': ('min_c','max_c'), 'method': 'Medias mensuales de temperaturas diarias mínima, media y máxima; referencias térmicas orientativas', 'resolution_note': 'Estimaciones meteorológicas regionales para un punto, no mediciones del campo'},
    'humidity': {'source': 'NASA POWER · meteorología (reanálisis)', 'unit': '%', 'aggregation': 'mean', 'key': 'relative_humidity_pct', 'method': 'Media mensual de humedad relativa diaria', 'resolution_note': 'Humedad atmosférica a 2 m; no equivale a humedad del suelo'},
    'precipitation': {'source': 'NASA POWER · precipitación corregida', 'unit': 'mm/mes', 'aggregation': 'sum', 'key': 'precipitation_mm', 'method': 'Suma mensual de precipitación diaria; solo meses completos', 'resolution_note': 'Estimaciones regionales, no pluviómetro del terreno'},
    'radiation': {'source': 'NASA POWER · radiación solar', 'unit': 'MJ/m²/día', 'aggregation': 'mean', 'key': 'solar_radiation_mj_m2_day', 'method': 'Media mensual de la irradiación solar diaria', 'resolution_note': 'Producto de radiación satelital/modelado con resolución distinta de meteorología'},
    'wind': {'source': 'NASA POWER · meteorología (reanálisis)', 'unit': 'm/s', 'aggregation': 'mean', 'key': 'wind_speed_ms', 'method': 'Media mensual de velocidad diaria a 2 m', 'resolution_note': 'Viento regional a 2 m, no medido dentro de la parcela'},
    'soil_moisture': {'source': 'NASA POWER HY · humedad del suelo (SFMC)', 'unit': 'm³/m³', 'aggregation': 'mean', 'key': 'surface_moisture_m3_m3', 'method': 'Promedio mensual de contenido volumétrico en la capa superficial', 'resolution_note': 'Producto de modelo/asimilación, con cobertura a escala regional. La atribución a SMAP debe confirmarse en la respuesta de POWER.'},
    'ndvi': {'source': 'Copernicus Sentinel-2 L2A', 'unit': 'NDVI', 'aggregation': 'mean', 'key': 'mean_ndvi', 'method': 'Promedio de composiciones estadísticas mensuales válidas', 'resolution_note': 'Estadísticas de píxeles válidos dentro del polígono (SCL 4/5), no mediciones diarias'},
}


def monthly_aggregate(daily_rows, key, aggregation='mean', extra_keys=()):
    groups = defaultdict(list)
    for row in daily_rows:
        d = row.get('date', '')
        if isinstance(d, str) and len(d) >= 7:
            groups[d[:7]].append(row)
    months = []
    for month_key, rows in sorted(groups.items()):
        year, month = map(int, month_key.split('-'))
        expected = calendar.monthrange(year, month)[1]
        values = [r[key] for r in rows if valid_number(r.get(key))]
        # Avoid presenting incomplete rainfall totals as a regular monthly total.
        value = (round(sum(values), 3) if aggregation == 'sum' and len(values) == expected else
                 round(mean(values), 3) if values and aggregation != 'sum' else None)
        output = {'date': f'{month_key}-01', 'value': value, 'valid_days': len(values),
                  'expected_days': expected, 'coverage_percent': round(100 * len(values) / expected, 1)}
        for field in extra_keys:
            samples = [r[field] for r in rows if valid_number(r.get(field))]
            output[field] = round(mean(samples), 3) if samples else None
        months.append(output)
    return months


def ndvi_monthly(rows):
    # The Copernicus statistics API already produces one interval per month.
    # Keep invalid/missing observations as null and do not interpolate.
    return [{'date': r['date'][:7] + '-01', 'value': r.get('mean_ndvi') if valid_number(r.get('mean_ndvi')) else None,
             'valid_pixels': r.get('valid_pixels', 0), 'total_pixels': r.get('total_pixels', 0),
             'valid_percent': r.get('valid_percent', 0)} for r in rows]


def quantile(values, q):
    values = sorted(values)
    if not values:
        return None
    index = (len(values) - 1) * q
    lo, hi = int(index), min(int(index) + 1, len(values) - 1)
    return round(values[lo] + (values[hi] - values[lo]) * (index - lo), 3)


def monthly_climatology(monthly):
    bymonth = defaultdict(list)
    for row in monthly:
        if valid_number(row.get('value')):
            bymonth[int(row['date'][5:7])].append(row['value'])
    results = []
    for m in range(1, 13):
        observations = bymonth[m]
        results.append({'month': m, 'label': ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][m-1],
                        'mean': round(mean(observations), 3) if observations else None,
                        'p10': quantile(observations, .1), 'p90': quantile(observations, .9),
                        'years_valid': len(observations)})
    return results


def seasonal_with_temperature(rows):
    season = monthly_climatology(rows)
    for field in ('min_c', 'max_c'):
        field_season = monthly_climatology([{'date': r['date'], 'value': r.get(field)} for r in rows])
        for current, extra in zip(season, field_season):
            current[field] = extra['mean']
    return season


def package_series(name, rows, start, end, *, status='success', error=None, source_override=None, metadata=None):
    spec = VARIABLES[name]
    total = len(rows)
    count = sum(valid_number(r.get('value')) for r in rows)
    return {'status': ('error' if error and not count else 'partial' if error or not count or count < total else status),
            'error': error,
            'source': source_override or spec['source'], 'unit': spec['unit'],
            'aggregation': spec['aggregation'], 'method': spec['method'],
            'resolution_note': spec['resolution_note'], 'sampling_method': 'selected_polygon' if name == 'ndvi' else 'representative_point',
            'coverage': {'start': str(start), 'end': str(end), 'valid_months': count, 'months': total},
            'monthly': rows, 'seasonal': seasonal_with_temperature(rows) if name == 'temperature' else monthly_climatology(rows), 'metadata': metadata or {}}


def unavailable(name, start, end, error):
    return package_series(name, [], start, end, status='error', error=error)


async def analyze_environment(polygon, copernicus, observations, *, today=None):
    today = today or date.today()
    last = date(today.year - 1, 12, 31)
    region = describe_region(polygon)
    point = region['representative_point']
    lat, lon = point['latitude'], point['longitude']

    async def run_power(first, params, community, standard):
        try:
            return await observations.daily(lat, lon, first, last, params, community, standard)
        except Exception as exc:
            return exc

    async def run_ndvi(year):
        async with _COPERNICUS_LIMIT:
            try:
                return year, await copernicus.statistics(polygon, date(year, 1, 1), date(year, 12, 31), 'P1M'), None
            except Exception as exc:
                return year, None, str(exc) if hasattr(exc, 'status_code') else 'Error al recuperar NDVI.'

    # Independent sources: failure of SMAP or IMERG must not stop meteorology or NDVI.
    met_params = tuple(p for p in WEATHER_PARAMETERS if p != 'ALLSKY_SFC_SW_DWN')
    weather, solar, soil, imerg, ndvi_years = await asyncio.gather(
        run_power(METEOROLOGY_START, met_params, 'AG', 'LST'),
        run_power(SOLAR_START, ('ALLSKY_SFC_SW_DWN',), 'AG', 'LST'),
        run_power(SMAP_START, SMAP_PARAMETERS, 'HY', 'UTC'),
        run_power(IMERG_START, IMERG_PARAMETERS, 'HY', 'UTC'),
        asyncio.gather(*(run_ndvi(year) for year in range(SENTINEL_START.year, last.year + 1))),
    )
    data = {}
    for name in ('temperature', 'humidity', 'precipitation', 'radiation', 'wind'):
        dataset_rows = solar if name == 'radiation' else weather
        dataset_start = SOLAR_START if name == 'radiation' else METEOROLOGY_START
        if isinstance(dataset_rows, Exception):
            data[name] = unavailable(name, dataset_start, last, str(dataset_rows))
        else:
            spec = VARIABLES[name]
            extra = spec.get('other', ())
            series = monthly_aggregate(dataset_rows, spec['key'], spec['aggregation'], extra)
            data[name] = package_series(name, series, dataset_start, last,
                                        metadata={'time_standard': 'LST', 'product_type': 'reanálisis / estimación meteorológica'})

    # Preserve the full POWER record even when a higher-resolution IMERG series exists.
    data['precipitation_power'] = data['precipitation']

    if isinstance(imerg, Exception):
        # Explicit fallback instead of pretending POWER coarse precipitation is GPM.
        data['precipitation']['metadata']['gpm_imerg_status'] = f'IMERG no disponible: {imerg}'
    else:
        gpm_series = monthly_aggregate(imerg, 'imerg_precipitation_mm', 'sum')
        if any(valid_number(r['value']) for r in gpm_series):
            data['precipitation'] = package_series('precipitation', gpm_series, IMERG_START, last,
                source_override='NASA GPM IMERG · precipitación satelital vía POWER HY',
                metadata={'time_standard': 'UTC', 'product_type': 'multisatélite; IMERG Final/Late según fecha',
                          'fallback_available': not isinstance(weather, Exception)})
        else:
            data['precipitation']['metadata']['gpm_imerg_status'] = 'IMERG no entregó meses válidos; se muestran estimaciones POWER.'

    if isinstance(soil, Exception):
        data['soil_moisture'] = unavailable('soil_moisture', SMAP_START, last, str(soil))
    else:
        soil_rows = monthly_aggregate(soil, 'surface_moisture_m3_m3', 'mean', ('rootzone_moisture_m3_m3',))
        data['soil_moisture'] = package_series('soil_moisture', soil_rows, SMAP_START, last,
            metadata={'time_standard': 'UTC', 'product_type': 'POWER HY, verificar origen SMAP L4 de alias SFMC/RZMC',
                      'resolution_note': 'SMAP L4 ~9 km solo si POWER confirma modo de alta resolución.'})

    ndvi_rows = []
    ndvi_failures = {}
    for year, result, error in ndvi_years:
        if error:
            ndvi_failures[str(year)] = error
            for month in range(1, 13):
                ndvi_rows.append({'date': f'{year}-{month:02d}-01', 'mean_ndvi': None,
                                  'valid_pixels': 0, 'total_pixels': 0, 'valid_percent': 0})
        else:
            bymonth = {r['date'][:7]: r for r in result.get('observations', [])}
            for month in range(1, 13):
                month_id = f'{year}-{month:02d}'
                ndvi_rows.append(bymonth.get(month_id, {'date': month_id + '-01', 'mean_ndvi': None,
                    'valid_pixels': 0, 'total_pixels': 0, 'valid_percent': 0}))
    ndvi_rows.sort(key=lambda r: r['date'])
    error = f"Fallaron {len(ndvi_failures)} años de Copernicus: {', '.join(ndvi_failures)}" if ndvi_failures else None
    data['ndvi'] = package_series('ndvi', ndvi_monthly(ndvi_rows), SENTINEL_START, last, error=error,
        metadata={'cloud_mask': 'SCL 4/5', 'resolution_m': 10,
                  'failed_years': ndvi_failures, 'product_type': 'índice calculado desde reflectancias satelitales'})

    if not any(d['status'] in ('success','partial') for d in data.values()):
        overall = 'error'
    elif any(d['status'] != 'success' for d in data.values()):
        overall = 'partial'
    else:
        overall = 'success'
    return {'status': overall, 'region': region, 'period': {'end': last.isoformat(), 'auto_selected': True,
        'note': 'Cobertura diferenciada por fuente; únicamente años completos para reducir sesgos estacionales.'},
        'datasets': data, 'soil_chemistry': {'status': 'unavailable', 'variables': ['pH','N','P','K'],
            'reason': 'SoilGrids REST no está disponible para uso productivo estable. pH y N son mapas modelados; P y K disponibles para plantas no son medidas satelitales directas.'},
        'note': 'Serie ambiental por fuente, sin predicciones ni datos inventados. El perfil estacional resume meses históricos válidos; cada pestaña identifica su escala.'}
