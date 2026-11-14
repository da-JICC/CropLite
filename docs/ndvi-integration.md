# TerraAI — Copernicus NDVI integration

## What was implemented

The existing React/Vite project now includes **Environmental Conditions → NDVI field explorer**, which provides:

- An OpenStreetMap basemap for field selection; click **Draw field**, click at least 3 vertices, then **Finish**.
- A clearly labeled **sample boundary**, which is **not** an actual cadastral/farm outline.
- **Simulated example** or **Live Copernicus API** mode.
- Date-range and interval selectors (10-day or monthly), a time-series graph, valid-pixel coverage and CSV export.
- A secure Python/FastAPI `/api/ndvi` endpoint that calls Copernicus Sentinel Hub's Statistical API using **server-side** OAuth credentials.
- Reusable authenticated token and a 6-hour in-memory result cache for repeated requests.
- No connection between live NDVI and the existing simulated crop suitability scores; they remain deliberately separated.

## Installation

Requirements: Node.js 20+, Python 3.10+ and an internet connection.

**1. Create a Copernicus OAuth client**

1. Open <https://shapps.dataspace.copernicus.eu/dashboard/> and log in with a Copernicus Data Space account.
2. In **User Settings → OAuth clients**, create a client for backend/server use.
3. Copy the **Client ID** and **Client Secret** (do not put them in browser code).
4. Create `backend/.env` from `backend/.env.example` and replace placeholders.

**2. Start the backend** (terminal 1, from the project root):

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Open <http://localhost:8000/api/status>. The JSON field `copernicus_configured` should be `true`. If it is `false`, review `backend/.env` and restart the server.

**3. Start the React frontend** (terminal 2, from the project root):

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>, select **Environmental Conditions**, find **NDVI field explorer**, and choose **Live Copernicus API**. Draw a polygon around a *real agricultural field*, set dates, and click **Analyze NDVI**. The Vite dev proxy forwards `/api/*` to port 8000; farmers never see your OAuth secret.

**4. Test the UI without credentials**

Select **Simulated example** and click **Analyze NDVI**. This uses generated `frontend/src/mocks/ndvi.json` values with an explicit demo label. It does **not** query any satellite or make claims about farm vegetation.

## NDVI basics and request mechanics

`NDVI = (B08 - B04) / (B08 + B04)` from Sentinel-2 L2A surface reflectance. The 10 m sample resolution works best for reasonably large, homogeneous agricultural fields. The backend uses an `evalscript` with `SCL` classes **4 (vegetation)** and **5 (bare/non-vegetated)**, and excludes other classified pixels including clouds, cloud shadows, snow and water. The Statistical API calculates interval mean/min/max and sample/no-data pixel counts. Intervals with no valid observations appear as gaps rather than zero NDVI.

- **API:** `POST http://localhost:8000/api/ndvi`
- **Request:** GeoJSON polygon in `EPSG:4326` coordinates in **[longitude, latitude]** order, ISO dates, and `interval` as `P10D` or `P1M`.

```json
{
  "polygon": {
    "type":"Polygon",
    "coordinates":[[[-71.415,-33.322],[-71.410,-33.322],[-71.410,-33.319],[-71.415,-33.319],[-71.415,-33.322]]]
  },
  "start":"2026-01-01",
  "end":"2026-06-30",
  "interval":"P10D"
}
```

The live response includes `source`, `status: "observed"`, `resolution_m`, `observations: [{date, end, mean_ndvi, min_ndvi, max_ndvi, valid_pixels, total_pixels, valid_percent}]` and `cache_hit`.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Cannot reach backend` | Run `uvicorn` in `backend`, confirm port 8000 and Vite dev proxy |
| `503` credentials missing | Put `CDSE_CLIENT_ID` / `CDSE_CLIENT_SECRET` in `backend/.env`, restart |
| `502` auth failed | Recreate OAuth client, check secret, account entitlements and internet |
| `429` | Copernicus quota/rate limit; reduce requests, use caching |
| No valid observations | Choose a longer date range, adjust field, or cloudy pixel masking prevents estimates |
| No basemap tiles | Check internet access to OpenStreetMap; satellite statistics can still be requested |
| Older HTML preview has no NDVI | That is a legacy static snapshot; run the updated **React/Vite** project |

### Scientific and operational limits

- The NDVI graph is an estimate of **spectral greenness**, not a direct measurement of soil moisture, crop yield, species or crop health.
- Users should select one actual field polygon. The example boundary and farm profiles are hypothetical.
- Cloud exclusion decreases the number of valid pixels; a high `valid_percent` is not an independent accuracy guarantee.
- Historical NDVI does not predict future crop suitability on its own.
- **Do not publish `backend/.env` or put the OAuth secret in `VITE_*` variables.**
- The sample backend protects against unusually large date ranges and polygons and caches repeat requests, but a public internet deployment should additionally have user authentication, request-rate limits, monitoring, HTTPS and persistent caching to protect account quotas.
- Copernicus limits and terms may change. Monitor the quota and attribution requirements in the Copernicus dashboard.

### Official references

- [Copernicus Authentication](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html)
- [Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
- [Statistical API examples](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical/Examples.html)
- [Copernicus Dashboard](https://shapps.dataspace.copernicus.eu/dashboard/)
