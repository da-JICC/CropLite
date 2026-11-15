"""NASA POWER daily climate point client; no credentials required."""
from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from datetime import date, timedelta

import httpx

POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'
PARAMETERS = ('T2M', 'T2M_MAX', 'T2M_MIN', 'RH2M')
CACHE_TTL_SECONDS = 6 * 3600
CACHE_MAX = 96


class PowerError(Exception):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(detail)
        self.status_code = status_code


def as_value(number):
    if number is None or isinstance(number, bool):
        return None
    try:
        value = float(number)
    except (TypeError, ValueError):
        return None
    if not (-900 < value < 900):
        return None
    return round(value, 3)


class PowerClient:
    def __init__(self):
        self.cache = OrderedDict()
        self.lock = asyncio.Lock()

    async def daily(self, latitude: float, longitude: float, start: date, end: date):
        # Coordinate rounding suppresses redundant requests for nearly identical points.
        # NASA POWER is regional-gridded, not field-scale sampling.
        key = (round(latitude, 3), round(longitude, 3), start.isoformat(), end.isoformat())
        now = time.monotonic()
        cached = self.cache.get(key)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            self.cache.move_to_end(key)
            return cached[1]
        async with self.lock:
            now = time.monotonic()
            cached = self.cache.get(key)
            if cached and now - cached[0] < CACHE_TTL_SECONDS:
                self.cache.move_to_end(key)
                return cached[1]
            params = {
                'parameters': ','.join(PARAMETERS), 'community': 'AG',
                'latitude': key[0], 'longitude': key[1],
                'start': start.strftime('%Y%m%d'), 'end': end.strftime('%Y%m%d'),
                'format': 'JSON', 'time-standard': 'LST',
            }
            try:
                async with httpx.AsyncClient(timeout=40, follow_redirects=False) as session:
                    response = await session.get(POWER_URL, params=params)
                    response.raise_for_status()
                    payload = response.json()
            except httpx.TimeoutException as exc:
                raise PowerError('NASA POWER timed out. Retry with a shorter date range.', 504) from exc
            except httpx.HTTPStatusError as exc:
                raise PowerError(f'NASA POWER returned HTTP {exc.response.status_code}.', 502) from exc
            except (httpx.HTTPError, ValueError) as exc:
                raise PowerError('Could not retrieve or decode NASA POWER observations.', 502) from exc

            try:
                source = payload['properties']['parameter']
                if not isinstance(source, dict) or any(not isinstance(source.get(k), dict) for k in PARAMETERS):
                    raise KeyError('Missing parameter series')
            except (TypeError, KeyError) as exc:
                raise PowerError('NASA POWER response did not contain the requested temperature series.', 502) from exc

            rows = []
            day = start
            while day <= end:
                datekey = day.strftime('%Y%m%d')
                rows.append({
                    'date': day.isoformat(),
                    'mean_c': as_value(source['T2M'].get(datekey)),
                    'max_c': as_value(source['T2M_MAX'].get(datekey)),
                    'min_c': as_value(source['T2M_MIN'].get(datekey)),
                    'relative_humidity_pct': as_value(source['RH2M'].get(datekey)),
                })
                day += timedelta(days=1)

            result = {
                'source': 'NASA POWER Daily API',
                'status': 'model_estimate',
                'start': start.isoformat(), 'end': end.isoformat(),
                'location': {'latitude': key[0], 'longitude': key[1]},
                'time_standard': 'LST (local solar time)',
                'units': {'mean_c': '°C', 'min_c': '°C', 'max_c': '°C', 'relative_humidity_pct': '%'},
                'resolution_note': 'Regional gridded meteorological/reanalysis estimates, not field thermometer measurements.',
                'observations': rows,
            }
            self.cache[key] = (time.monotonic(), result)
            self.cache.move_to_end(key)
            while len(self.cache) > CACHE_MAX:
                self.cache.popitem(last=False)
            return result
