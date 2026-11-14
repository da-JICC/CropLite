# TerraAI · agricultural decision support prototype

**NASA Space Apps Challenge 2026 concept** — frontend-first, no backend.

TerraAI explores how different crop rotations could affect soil health, water demand and resilience. It is a **decision-support demonstration**, not a source of verified crop advice or actual NASA observations.

## Choose how to open it

### Option A · Instant preview, no installation

Open the separately supplied **`TerraAI_Interactive_Preview.html`** in Chrome, Firefox or Edge. It is a **self-contained, working offline preview** with its own interactive controls and all nine screens. It does not need the internet, Node or npm. This is a companion to—not a build of—the React source.

### Option B · Run the actual React/Vite project

1. Extract `TerraAI_React_Project.zip`.
2. Open a terminal in `terra-ai/frontend` (the directory containing `package.json`).
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the URL Vite prints, usually **http://localhost:5173**.

**Windows PowerShell** example:

```powershell
cd terra-ai\frontend
npm install
npm run dev
```

For a production bundle (after installing dependencies):

```bash
npm run build
npm run preview
```

If you get a **blank page**, open browser Developer Tools (`F12` → Console), copy the first red error and check whether `npm install` completed without errors. Confirm that you're running the commands from `frontend`, and that the JavaScript console does not report missing packages.

> Build status: React/JSX source was syntax-checked, but **`npm install`/`vite build` could not be run here** because this execution environment cannot reach the npm registry. The HTML offline companion was independently executed in a JS runtime across all nine screens. Do not interpret that as a verified React production build.

## What's included

| Section | Core functionality |
|---|---|
| Overview | Farm indicators, trend chart, schematic farm location, farm insights |
| My Farm | Three Chilean example farms, profile, constraints and session planning notes |
| Environment | Interactive environmental indicators, chart switching and season filters, Leaflet map |
| Crop Rotation Explorer | Select farm, planning horizon and priority; inspect three crop-rotation scenarios and crop characteristics |
| Predictive Intelligence | Explicitly hypothetical 7-, 15- and 30-day soil moisture scenarios |
| Strategy Comparison | Eight comparison criteria, priority-weighted transparent fit indicator, benefits and limitations |
| Recommendations | Contextual simulated suggestions and risks, with local review caveats |
| Reports | Generate a standalone HTML summary; browser printing enables Save to PDF |
| Data Sources | 18 candidate science sources, categories, official links and research statuses |

All initial farm, crop, climate and rotation data are simulated, internally consistent demonstrations.

## Stack (planned for real development)

- **React 18 + Vite 5** for the frontend app.
- **Tailwind CSS 3** available for utility styling, plus a custom stylesheet.
- **React Leaflet / Leaflet** for maps. The React app currently uses a tile-free schematic canvas (no tile requests) with illustrative Leaflet region markers, not surveyed boundaries or real vegetation/water overlays. OSM tiles can be connected in a later phase if approved.
- **Recharts** for charts.
- **Lucide React** for iconography.

**No API requests, backend, ML models, spatial processing, authentication, database or satellite downloads are implemented.** The frontend service layer currently reads mock JSON and is designed to be swapped for API calls later.

## Structure

```text
terra-ai/
  README.md
  docs/
    api-contracts.md
    qa-notes.md
  frontend/
    package.json
    vite.config.js
    tailwind.config.js
    postcss.config.js
    index.html
    src/
      main.jsx
      App.jsx
      styles.css
      components/
        layout/Sidebar.jsx
        maps/FarmMap.jsx
        charts/TrendChart.jsx
        ui/Elements.jsx
      pages/
        index.jsx
        shared.jsx
        Dashboard.jsx
        MyFarm.jsx
        Environment.jsx
        RotationExplorer.jsx
        Predictive.jsx
        Comparison.jsx
        Recommendations.jsx
        Reports.jsx
        DataSources.jsx
      services/dataService.js
      utils/strategy.js
      mocks/{farms,crops,rotations,environment,predictions,recommendations,reports,sources}.json
```

Each screen lives in a separate module and `pages/index.jsx` re-exports them; shared selectors, timeline and crop helpers are in `pages/shared.jsx`.

## How scores work (IMPORTANT)

**Strategy A** is the current mock rotation; **B** emphasizes soil health; **C** emphasizes water resilience. The per-criterion 0–100 values are invented for interface demonstrations and should not be used to rank real fields.

The displayed **priority fit** is a transparent weighted sum of five or fewer indicators. It **inverts water demand** (`100 - water demand`) when water is used as a benefit in the fit calculation. Weights are listed in the comparison screen and implemented in `src/utils/strategy.js`.

Changing priority changes this fit value **only**. The underlying scenario attributes do not pretend to adjust dynamically from a scientific model. Changing farms changes the actual mock profiles, rotation sequences and scores.

## Data integrity, ethics, and next steps

- No NASA dataset has been connected or ingested.
- No yield, profit, water-use or climate outcome is forecast.
- No crop listed should be presumed suitable for any real farm. Local pH, soils, planting calendars, irrigation, pest pressure, labor, machinery and market access require validation.
- Scientific source statuses are research labels; **“Selected” does not mean connected**.
- Some USDA / PRISM datasets are US-specific; the sample farms are Chilean, so these sources may be unsuitable for their local data.

Suggested development order: (1) validate personas and rotation comparisons with farmers; (2) confirm datasets and regional coverage; (3) implement FastAPI mock contract; (4) implement real geospatial ingestion, provenance and quality controls; (5) compare validated recommendations with local agronomic expertise.

## Licenses

Prototype source delivered for user modification. React/Leaflet/Recharts/Lucide and OpenStreetMap base-map tiles each retain their respective licenses and terms. The preview relies on no external assets.

---

## NEW — Live NDVI integration (Copernicus Sentinel-2)

The React app now includes **Environmental Conditions → NDVI field explorer**, allowing field polygon drawing, a time-series chart, date controls and CSV export. It has two clearly separated modes: **simulated demo** (no account necessary) and **real Sentinel-2 L2A observations** (requires a configured Copernicus OAuth client on the backend). Other dashboard cards and crop recommendations remain simulated.

**Quick start** (two terminals, from project root):

```bash
# Terminal 1 — NDVI backend
cd backend
python -m pip install -r requirements.txt
# Copy .env.example to .env, then set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET
python -m uvicorn app:app --reload --port 8000

# Terminal 2 — React app
cd frontend
npm install
npm run dev
```

For detailed setup, troubleshooting, security and the API contract see **[`docs/ndvi-integration.md`](docs/ndvi-integration.md)**. The standalone `TerraAI_Interactive_Preview.html` is an older static demo and **does not include** the new NDVI integration; use the React project for this feature.
