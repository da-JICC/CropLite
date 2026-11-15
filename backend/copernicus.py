"""Copernicus CDSE Sentinel Hub Statistical API client for TerraAI.

No satellite data is bundled with the project. Only authenticated requests made
with developer-provided credentials return actual Sentinel-2 measurements.
"""
from __future__ import annotations

import asyncio
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1"

EVALSCRIPT = """//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04", "B08", "SCL", "dataMask"]}],
    output: [
      {id: "ndvi", bands: 1, sampleType: "FLOAT32"},
      {id: "dataMask", bands: 1, sampleType: "UINT8"}
    ]
  };
}
function evaluatePixel(s) {
  // 4 = vegetation; 5 = bare/non-vegetated; remove clouds, shadows,
  // water, cirrus, snow and unclassified SCL pixels.
  let valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5);
  let sum = s.B08 + s.B04;
  valid = valid && sum > 0;
  return {
    ndvi: [valid ? (s.B08 - s.B04) / sum : 0],
    dataMask: [valid ? 1 : 0]
  };
}
"""


# New analysis includes NDMI. Both outputs use the same valid-pixel mask.
# B11 has 20m native resolution: request 20m to avoid fake spatial precision.
EVALSCRIPT_DUAL = """//VERSION=3
function setup() {
  return {
    input: [{bands: ["B04", "B08", "B11", "SCL", "dataMask"]}],
    output: [
      {id: "ndvi", bands: 1, sampleType: "FLOAT32"},
      {id: "ndmi", bands: 1, sampleType: "FLOAT32"},
      {id: "dataMask", bands: 1, sampleType: "UINT8"}
    ]
  };
}
function evaluatePixel(s) {
  let valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5);
  let sumNDVI = s.B08 + s.B04;
  let sumNDMI = s.B08 + s.B11;
  valid = valid && sumNDVI > 0 && sumNDMI > 0;
  return {
    ndvi: [valid ? (s.B08 - s.B04) / sumNDVI : 0],
    ndmi: [valid ? (s.B08 - s.B11) / sumNDMI : 0],
    dataMask: [valid ? 1 : 0]
  };
}
"""

class CopernicusError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class CopernicusClient:
    def __init__(self):
        self._token: str | None = None
        self._expires_at = 0.0
        self._token_lock = asyncio.Lock()
        self._result_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._cache_lock = asyncio.Lock()
        # Shared cap across daily explorer and multi-year decision context.
        self._request_limit = asyncio.Semaphore(2)

    @property
    def configured(self) -> bool:
        return bool(os.getenv("CDSE_CLIENT_ID") and os.getenv("CDSE_CLIENT_SECRET"))

    async def token(self, http: httpx.AsyncClient) -> str:
        if self._token and time.monotonic() < self._expires_at:
            return self._token
        async with self._token_lock:
            if self._token and time.monotonic() < self._expires_at:
                return self._token
            if not self.configured:
                raise CopernicusError(
                    "Server credentials are not configured. Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET in backend/.env.",
                    503,
                )
            try:
                resp = await http.post(TOKEN_URL, data={
                    "grant_type": "client_credentials",
                    "client_id": os.environ["CDSE_CLIENT_ID"],
                    "client_secret": os.environ["CDSE_CLIENT_SECRET"],
                })
                resp.raise_for_status()
                data = resp.json()
                self._token = data["access_token"]
                self._expires_at = time.monotonic() + max(30, int(data.get("expires_in", 300)) - 90)
                return self._token
            except (httpx.HTTPError, KeyError, ValueError) as exc:
                raise CopernicusError("Copernicus authentication failed. Verify your OAuth client credentials.", 502) from exc

    async def statistics(self, polygon: dict, start: date, end: date, interval: str, *, include_ndmi: bool = False) -> dict:
        if not self.configured:
            raise CopernicusError(
                "Copernicus credentials are not configured on the TerraAI backend. Demo mode is available.", 503
            )
        # Stable, rounded polygon + dates is a safe local cache key.
        import hashlib
        import json
        key = hashlib.sha256(json.dumps([polygon, str(start), str(end), interval, include_ndmi], sort_keys=True).encode()).hexdigest()
        cached = self._result_cache.get(key)
        if cached and cached[0] > time.monotonic():
            return {**cached[1], "cache_hit": True}

        payload = {
            "input": {
                "bounds": {
                    "geometry": polygon,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {"maxCloudCoverage": 80, "mosaickingOrder": "leastCC"},
                }],
            },
            "aggregation": {
                "timeRange": {
                    "from": f"{start.isoformat()}T00:00:00Z",
                    "to": f"{(end + timedelta(days=1)).isoformat()}T00:00:00Z",
                },
                "aggregationInterval": {"of": interval},
                "lastIntervalBehavior": "SHORTEN",
                "evalscript": EVALSCRIPT_DUAL if include_ndmi else EVALSCRIPT,
                "resx": 20 if include_ndmi else 10,
                "resy": 20 if include_ndmi else 10,
            },
        }
        try:
            async with self._request_limit:
                async with httpx.AsyncClient(timeout=80) as http:
                    access_token = await self.token(http)
                    resp = await http.post(STATS_URL, json=payload, headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                })
                if resp.status_code == 429:
                    raise CopernicusError("Copernicus request limit reached. Retry later or reduce the analysis area.", 429)
                if resp.status_code in (401, 403):
                    # Force renewal on the next call, without logging secrets.
                    self._token = None
                    raise CopernicusError("Copernicus access denied. Check OAuth client access and plan limits.", 502)
                if resp.is_error:
                    raise CopernicusError(f"Copernicus could not process this polygon or date range (HTTP {resp.status_code}).", 502)
                data = resp.json()
        except httpx.HTTPError as exc:
            raise CopernicusError("Could not contact Copernicus. Check the backend network connection.", 502) from exc
        except (ValueError, KeyError) as exc:
            raise CopernicusError("Unexpected response returned by Copernicus.", 502) from exc

        observations = []
        for item in data.get("data", []):
            stats = item.get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {})
            sample_count = int(stats.get("sampleCount", 0))
            no_data_count = int(stats.get("noDataCount", sample_count))
            valid_pixels = max(0, sample_count - no_data_count)
            mean = stats.get("mean") if valid_pixels else None
            ndmi_stats = item.get("outputs", {}).get("ndmi", {}).get("bands", {}).get("B0", {}).get("stats", {})
            ndmi_count = int(ndmi_stats.get("sampleCount", 0)) - int(ndmi_stats.get("noDataCount", 0))
            ndmi_mean = ndmi_stats.get("mean") if ndmi_count > 0 else None
            observations.append({
                "mean_ndmi": round(float(ndmi_mean), 4) if ndmi_mean is not None else None,
                "date": item["interval"]["from"][:10],
                "end": item["interval"]["to"][:10],
                "mean_ndvi": round(float(mean), 4) if mean is not None else None,
                "min_ndvi": round(float(stats["min"]), 4) if valid_pixels and stats.get("min") is not None else None,
                "max_ndvi": round(float(stats["max"]), 4) if valid_pixels and stats.get("max") is not None else None,
                "valid_pixels": valid_pixels,
                "total_pixels": sample_count,
                "valid_percent": round(100 * valid_pixels / sample_count, 1) if sample_count else 0,
            })
        result = {
            "source": "Copernicus Sentinel-2 L2A",
            "status": "observed",
            "index": "NDVI",
            "interval": interval,
            "start": str(start),
            "end": str(end),
            "cloud_mask": "SCL classes 4, 5 only; other pixels excluded",
            "resolution_m": 20 if include_ndmi else 10,
            "indexes": ["NDVI", "NDMI"] if include_ndmi else ["NDVI"],
            "observations": observations,
            "cache_hit": False,
        }
        # Don't hold a lock during the expensive upstream call.
        async with self._cache_lock:
            now = time.monotonic()
            self._result_cache = {k: v for k, v in self._result_cache.items() if v[0] > now}
            if len(self._result_cache) >= 100:
                self._result_cache.pop(next(iter(self._result_cache)))
            self._result_cache[key] = (now + 6 * 3600, result)
        return result
