# TerraAI — NASA POWER temperature update (Windows / VS Code)

This is an **updated copy of the earlier Copernicus NDVI React/FastAPI project** supplied in the chat. It does NOT automatically merge into your local GitHub project. Preserve a backup before copying newer files.

## What is added

Under **Environmental Conditions**, you'll find **Temperature Intelligence** *below* the existing Copernicus NDVI Explorer. It reuses the same drawn field boundary, samples NASA POWER daily air temperature at the approximate center, and plots min/mean/max temperatures, counted heat/cold exposure days and accumulated GDD. CSV export is included.

No extra NASA account or API key is required for POWER. The existing Copernicus OAuth settings remain unchanged.

## Start both servers

Open the project `terra-ai` folder in VS Code.

**Terminal 1 — Python backend**

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# If using Copernicus, copy .env.example to .env and enter credentials as before.
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

Check <http://localhost:8000/api/status>. `nasa_power_available: true` indicates the service is installed, **not** that a NASA request has succeeded.

**Terminal 2 — React frontend** (run from the `terra-ai` root in another terminal)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open <http://localhost:5173> → **Environmental Conditions**.

## First real test

1. Find **NDVI Field Explorer** and draw a small farm field, then click **Finish**. The temperature panel uses the same field.
2. Scroll to **Temperature Intelligence**.
3. Choose **From** `2026-01-01` and **To** `2026-02-01` for a short historical test.
4. Keep demo GDD thresholds at 10 °C and 30 °C (adjust them for your actual crop when you have validated parameters).
5. Click **Analyze temperature**.
6. Confirm min/mean/max curves and metrics load and try the **CSV** button.
7. If NASA is unavailable or returns missing days, the app displays an error or gaps; it never substitutes simulated values as real data.

## Things to know

- NASA POWER provides **regional gridded meteorological/reanalysis estimates**, not a thermometer reading inside the field.
- **GDD** is a simplified calculation of development potential, not a yield or death prediction. Heat and cold thresholds are user-adjustable **screening thresholds**.
- The app currently requests 2 m **air temperature**, not MODIS **land-surface temperature**. MODIS map tiles/QA were not implemented because the live NASA visualization endpoint and Earthdata access could not be verified here.
- The rest of the older dashboards remain simulated as before.
- Avoid publishing `.env` or tokens. The included `.gitignore` excludes backend secrets and the Python virtual environment.

For details on endpoints, uncertainty, test results and limitations see [`docs/temperature-integration.md`](docs/temperature-integration.md).
