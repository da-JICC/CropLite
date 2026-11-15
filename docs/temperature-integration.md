# NASA POWER temperature — technical integration guide

## Source and scope

- **NASA POWER Daily API:** https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- `T2M` (daily mean), `T2M_MIN` (daily minimum), `T2M_MAX` (daily maximum): °C.
- `RH2M`: relative humidity, %.
- Point requests use `community=AG`, JSON, and `time-standard=LST` (local solar time).
- A **single approximate field centroid** is sampled. The result is gridded climate context, not an area-average or on-farm observation. Spatial resolution depends on source parameter and grid.
- Available dates vary; recent days may not yet be available. Missing data (`-999`) remain `null`.

## Code structure

| File | Purpose |
|---|---|
| `backend/nasa_power_service.py` | NASA REST API client, response parser, 6-hour in-memory bounded cache, upstream errors |
| `backend/agroclimate.py` | Temperature summary, exposure-day counting and GDD calculations |
| `backend/app.py` | Validated FastAPI endpoints while retaining `/api/ndvi` |
| `frontend/src/services/climateService.js` | Browser-to-backend fetch, validation and error handling |
| `frontend/src/components/climate/TemperatureExplorer.jsx` | Map preview, historical temperature + GDD charts, CSV export |
| `frontend/src/pages/Environment.jsx` | Shares the actual drawn polygon with NDVI and Temperature panels |

## Endpoints

All are public GET endpoints served by your local backend (no NASA client secret needed).

- `/api/climate/temperature?latitude=-33.32&longitude=-71.41&start=2026-01-01&end=2026-02-01`
- `/api/climate/temperature-summary?latitude=-33.32&longitude=-71.41&start=2026-01-01&end=2026-02-01&heat_threshold=35&cold_threshold=0`
- `/api/climate/gdd?latitude=-33.32&longitude=-71.41&start=2026-01-01&end=2026-02-01&tbase=10&tupper=30`

`/api/climate/temperature` returns all three: `observations`, `summary`, `gdd`, plus metadata. The other endpoints return their respective calculation only.

Query parameters:

| Name | Type | Explanation |
|---|---|---|
| `latitude`, `longitude` | float | WGS84 coordinates of selected field centroid |
| `start`, `end` | YYYY-MM-DD | Historical daily window, at most 366-day difference |
| `heat_threshold` | °C (default 35) | Count `T2M_MAX > threshold` days |
| `cold_threshold` | °C (default 0) | Count `T2M_MIN < threshold` days |
| `tbase` | °C (default 10) | Basal GDD temperature |
| `tupper` | °C (default 30) | Upper GDD temperature cap; must be > base |

Missing daily observations break heat/cold streaks, and GDD for missing dates remains null. The accumulated GDD total excludes missing days and is **incomplete** in such a case. The GDD method is `max(0, min(T2M, tupper) - tbase)`, using **daily mean air temperature**; different crops/phenology may need more advanced methods.

## Data accuracy and agronomy

1. NASA POWER temperature is **not a direct ground-station measurement** and must not be confused with satellite thermal imagery.
2. A day below 0 °C does **not** prove frost damage to a particular plant; meteorological resolution, exposure duration and crop stage matter.
3. `tupper` is a **developmental cap**, not a lethal heat threshold. Heat/cold counters report exposure, not proven crop damage.
4. This feature does **not** infer crop suitability, predict yield, or supply weather forecasts. The 20-crop threshold matrix can later supply validated threshold values.
5. The field center is only an approximate point; large elevation changes and localized microclimates are unresolved. Ground-station validation is recommended.
6. A regional product can include observations from reanalysis/satellite inputs; label it as NASA POWER model estimate rather than raw satellite temperature observation.

## MODIS assessment (NOT integrated)

NASA MODIS MOD11A1 Version 6.1: https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD11A1/

The product provides land-surface temperature by day/night at ~1 km, with associated QC layers and Earthdata-supported access. In this build **no MODIS overlay is installed** because the exact live tile endpoint/authorization and quality-mask implementation could not be verified. A future implementation should:

1. Confirm NASA Earthdata/GIBS service layer identifiers and dates (or arrange valid LP DAAC product access).
2. Apply clear-sky / QC masks; convert MOD11A1 DN to °C with the product scale factor.
3. Display **LST** separately from POWER **air temperature**, with a dated legend and attribution.
4. Validate the data coverage before displaying the layer; do not invent a heat map.

## Tests and known limitations

Run offline backend tests from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
.\.venv\Scripts\python.exe -m pytest -q
```

Existing NDVI tests and new climate tests cover validation, missing data, caching, GDD and mocked NASA response parsing. This environment has no outbound network access to the NASA POWER API and no npm registry access, so **live NASA requests and a full Vite build were not verified here**. Run the browser app on Windows, submit a real POWER request, and verify charts and CSV before deploying.

## Source references

- NASA POWER Daily API https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- MODIS MOD11A1.061 https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD11A1/
