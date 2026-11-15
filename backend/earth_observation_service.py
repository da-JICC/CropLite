"""Extended NASA POWER observations for TerraAI (no secrets or fabricated samples).

Meteorological/solar series are POWER gridded estimates; additional HY series are
requested independently so failure of SMAP/IMERG does not hide other variables.
"""
from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from datetime import date, timedelta
from math import isfinite

import httpx

POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'
WEATHER_PARAMETERS = ('T2M', 'T2M_MIN', 'T2M_MAX', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M')
SMAP_PARAMETERS = ('SFMC', 'RZMC')
IMERG_PARAMETERS = ('IMERG_PRECTOT',)
DAILY_WEATHER_PARAMETERS = ('T2M','T2M_MIN','T2M_MAX','T2MDEW','RH2M','PRECTOTCORR','WS2M','PS')
FIELDS = {
    'T2M': 'mean_c', 'T2M_MIN': 'min_c', 'T2M_MAX': 'max_c',
    'RH2M': 'relative_humidity_pct', 'T2MDEW':'dewpoint_c', 'PS':'surface_pressure_kpa', 'PRECTOTCORR': 'precipitation_mm',
    'ALLSKY_SFC_SW_DWN': 'solar_radiation_mj_m2_day', 'WS2M': 'wind_speed_ms',
    'SFMC': 'surface_moisture_m3_m3', 'RZMC': 'rootzone_moisture_m3_m3',
    'IMERG_PRECTOT': 'imerg_precipitation_mm',
}
MISSING = -999.0


class ObservationError(Exception):
    pass


def clean_value(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        n = float(v)
    except (ValueError, TypeError):
        return None
    return round(n, 5) if isfinite(n) and n != MISSING and -900 < n < 90000 else None


def build_daily_rows(payload: dict, names: tuple[str, ...], start: date, end: date):
    try:
        source = payload['properties']['parameter']
        if any(not isinstance(source.get(p), dict) for p in names):
            raise KeyError('parameter series missing')
    except (KeyError, TypeError, AttributeError) as exc:
        raise ObservationError('NASA POWER did not return the requested variables.') from exc
    rows = []
    current = start
    while current <= end:
        key = current.strftime('%Y%m%d')
        row = {'date': current.isoformat()}
        for p in names:
            row[FIELDS[p]] = clean_value(source[p].get(key))
        rows.append(row)
        current += timedelta(days=1)
    return rows


class EarthObservationClient:
    def __init__(self):
        self.cache = OrderedDict()
        self.lock = asyncio.Lock()
        self.limit = asyncio.Semaphore(2)

    async def daily(self, latitude: float, longitude: float, start: date, end: date,
                    parameters: tuple[str, ...] = WEATHER_PARAMETERS, community='AG', time_standard='LST'):
        """Fetch decade-sized chunks and merge. Cached per source, coordinates and interval."""
        if start > end:
            raise ObservationError('Invalid time range.')
        coordinates = (round(latitude, 3), round(longitude, 3))
        key = (coordinates, str(start), str(end), parameters, community, time_standard)
        now = time.monotonic()
        existing = self.cache.get(key)
        if existing and existing[0] > now:
            self.cache.move_to_end(key)
            return existing[1]
        async with self.lock:
            existing = self.cache.get(key)
            if existing and existing[0] > time.monotonic():
                return existing[1]
            rows = []
            piece = start
            # Moderate chunks reduce timeouts without requesting every calendar year.
            while piece <= end:
                boundary = min(end, date(min(piece.year + 11, end.year), 12, 31))
                params = {
                    'parameters': ','.join(parameters), 'community': community,
                    'latitude': coordinates[0], 'longitude': coordinates[1],
                    'start': piece.strftime('%Y%m%d'), 'end': boundary.strftime('%Y%m%d'),
                    'format': 'JSON', 'time-standard': time_standard,
                }
                try:
                    async with self.limit:
                        async with httpx.AsyncClient(timeout=160, follow_redirects=False) as http:
                            response = await http.get(POWER_URL, params=params)
                            response.raise_for_status()
                            payload = response.json()
                except (httpx.HTTPError, ValueError) as exc:
                    raise ObservationError(f'NASA POWER ({community}, {piece.year}–{boundary.year}) no disponible: {type(exc).__name__}.') from exc
                rows.extend(build_daily_rows(payload, parameters, piece, boundary))
                piece = boundary + timedelta(days=1)
            self.cache[key] = (time.monotonic() + 24 * 3600, rows)
            self.cache.move_to_end(key)
            while len(self.cache) > 24:
                self.cache.popitem(last=False)
            return rows
