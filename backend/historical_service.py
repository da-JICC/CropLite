"""Six latest *completed* calendar years, using the existing NASA and CDSE clients.

NASA POWER: daily 2 m air temperature at one representative point.
Copernicus: one polygonal statistical request per calendar year, monthly mosaics.
Missing months/years remain missing; no interpolation or forecasts are made.
"""
from __future__ import annotations

import asyncio
import calendar
from datetime import date
from math import isfinite

from region_service import describe_region

YEARS_BACK = 6
NDVI_INTERVAL = 'P1M'
# One shared limiter also protects against separate simultaneous region requests.
_COPERNICUS_LIMIT = asyncio.Semaphore(2)


def completed_years(today: date | None = None, limit: int = YEARS_BACK) -> list[int]:
    today = today or date.today()
    last = today.year - 1
    return list(range(last - limit + 1, last + 1))


def valid_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def annual_temperature_summary(rows: list[dict], year: int) -> dict:
    relevant = [r for r in rows if r.get('date', '').startswith(f'{year}-')]
    means = [r['mean_c'] for r in relevant if valid_number(r.get('mean_c'))]
    mins = [r['min_c'] for r in relevant if valid_number(r.get('min_c'))]
    maxs = [r['max_c'] for r in relevant if valid_number(r.get('max_c'))]
    expected = 366 if calendar.isleap(year) else 365
    coverage = round(len(means) / expected * 100, 1)
    return {
        'year': year, 'expected_days': expected, 'valid_days': len(means),
        'coverage_percent': coverage,
        'mean_c': round(sum(means)/len(means), 2) if means else None,
        'min_c': min(mins) if mins else None,
        'max_c': max(maxs) if maxs else None,
        'quality': 'complete' if len(means) == expected else 'partial' if means else 'unavailable',
    }


def annual_ndvi_summary(rows: list[dict], year: int, failed: bool = False) -> dict:
    relevant = [r for r in rows if r.get('date', '').startswith(f'{year}-')]
    valid = [r['mean_ndvi'] for r in relevant if valid_number(r.get('mean_ndvi'))]
    # Monthly mosaics are composite statistics, not a separate acquisition per month.
    return {
        'year': year, 'intervals_expected': 12, 'valid_intervals': len(valid),
        'coverage_percent': round(len(valid)/12*100, 1),
        'mean_ndvi': round(sum(valid)/len(valid), 4) if valid else None,
        'quality': 'error' if failed else 'complete' if len(valid) == 12 else 'partial' if valid else 'unavailable',
    }


async def analyze_history(polygon: dict, copernicus, power, *, today: date | None = None):
    years = completed_years(today)
    start, end = date(years[0], 1, 1), date(years[-1], 12, 31)
    region = describe_region(polygon)
    point = region['representative_point']

    async def fetch_year(year):
        async with _COPERNICUS_LIMIT:
            try:
                result = await copernicus.statistics(polygon, date(year, 1, 1), date(year, 12, 31), NDVI_INTERVAL)
                return year, result, None
            except Exception as exc:
                # No fabricated observations: preserve error in the specific year.
                return year, None, str(exc) if hasattr(exc, 'status_code') else 'No se pudo consultar Copernicus este año.'

    # Run independently: NASA must not be withheld because Copernicus fails.
    ndvi_years, climate_result = await asyncio.gather(
        asyncio.gather(*(fetch_year(year) for year in years)),
        power.daily(point['latitude'], point['longitude'], start, end),
        return_exceptions=True,
    )
    ndvi_observations = []
    failures = {}
    for year, result, error in ndvi_years:
        if error:
            failures[str(year)] = error
        else:
            # Keep twelve explicit monthly slots so missing acquisitions display as
            # gaps rather than connecting two observed points across absent months.
            observed = {row['date'][:7]: row for row in result.get('observations', [])}
            for month in range(1, 13):
                key = f'{year}-{month:02d}'
                ndvi_observations.append(observed.get(key, {
                    'date': f'{key}-01', 'end': None,
                    'mean_ndvi': None, 'min_ndvi': None, 'max_ndvi': None,
                    'valid_pixels': 0, 'total_pixels': 0, 'valid_percent': 0,
                }))
    ndvi_observations.sort(key=lambda item: item['date'])

    ndvi_year_summaries = [annual_ndvi_summary(ndvi_observations, year, str(year) in failures) for year in years]
    ndvi_success_count = sum(1 for row in ndvi_year_summaries if row['valid_intervals'] > 0)
    ndvi_status = 'success' if ndvi_success_count == len(years) and not failures else 'partial' if ndvi_success_count else 'error'
    ndvi = {
        'source': 'Copernicus Sentinel-2 L2A', 'status': ndvi_status,
        'sampling_method': 'selected_polygon', 'error': '; '.join(f'{year}: {detail}' for year, detail in failures.items()) or None,
        'data': {'source': 'Copernicus Sentinel-2 L2A', 'interval': NDVI_INTERVAL,
                 'interval_explanation': 'mosaicos estadísticos mensuales, no observaciones diarias ni imágenes individuales',
                 'resolution_m': 10, 'cloud_mask': 'SCL 4 y 5', 'observations': ndvi_observations,
                 'annual': ndvi_year_summaries, 'errors_by_year': failures},
    }

    if isinstance(climate_result, Exception):
        message = str(climate_result) if hasattr(climate_result, 'status_code') else 'No se pudo consultar NASA POWER.'
        temperature = {'source': 'NASA POWER Daily API', 'status': 'error',
                       'sampling_method': 'representative_point', 'error': message, 'data': None}
    else:
        climate_rows = climate_result['observations']
        annual = [annual_temperature_summary(climate_rows, year) for year in years]
        valid_years = sum(row['valid_days'] > 0 for row in annual)
        status = 'success' if valid_years == len(years) and all(row['quality'] == 'complete' for row in annual) else 'partial' if valid_years else 'error'
        temperature = {
            'source': 'NASA POWER Daily API', 'status': status,
            'sampling_method': 'representative_point', 'error': None,
            'data': {**climate_result, 'annual': annual},
        }

    overall = ('success' if ndvi['status'] == temperature['status'] == 'success'
               else 'partial' if any(d['status'] in ('success', 'partial') for d in (ndvi, temperature)) else 'error')
    return {
        'status': overall,
        'region': region,
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'years': years,
                   'basis': 'six_last_complete_calendar_years', 'auto_selected': True},
        'datasets': {'ndvi': ndvi, 'temperature': temperature},
        'note': 'Seis últimos años calendario completos. Copernicus: estadísticas mensuales de un polígono; NASA POWER: temperaturas diarias estimadas para un punto. La calidad y cobertura varían por año.',
    }
