# CropLite

**Satellite-informed crop planning and agricultural decision support**

Developed for **NASA Space Apps Challenge 2026 — Adapting Farms with NASA Data**

## Overview

CropLite is a web application that helps people explore agricultural land, understand historical environmental conditions, compare crop suitability, and plan crop sequences within a single agricultural year.

Users draw a field on a satellite basemap. CropLite then brings together environmental datasets and crop-specific agronomic references to generate an explainable suitability ranking across **20 crops** and explore possible annual rotations.

CropLite is a **decision-support prototype**. It does not predict yields or guarantee that a crop will succeed.

## Motivation

Agricultural decisions are often made before the growing season begins, when farmers must choose what to plant and how to organize their land under uncertain environmental conditions.

Organizations such as NASA and the Copernicus programme provide valuable Earth observation and climate information, but the data can be difficult to access, compare, or translate into practical decisions without specialized tools.

CropLite aims to make that information easier to use. Its purpose is not to replace local agricultural knowledge, but to help users make more informed decisions using accessible maps, historical evidence, and understandable agronomic comparisons.

## Project Objectives

- **Improve access to environmental information:** connect field locations with relevant satellite observations and historical climate records.
- **Support crop selection:** compare the requirements of 20 crops against available environmental evidence.
- **Assist annual planning:** explore two-crop sequences that fit within one calendar year.
- **Make recommendations understandable:** explain the factors behind rankings and clearly communicate uncertainty.
- **Encourage informed adaptation:** help users investigate alternatives as growing conditions change.

## Key Features

### Satellite field explorer

- Locate an area using an interactive geographic map.
- Draw, edit, or remove a field boundary.
- View Esri World Imagery satellite basemap tiles or switch to OpenStreetMap.
- Work with field polygons represented in GeoJSON (WGS84).

**Note:** The Esri basemap is a multi-date imagery mosaic, not a live satellite feed or a dated Sentinel-2 observation.

### Environmental data exploration

- Access historical temperature, precipitation, solar radiation, and related meteorological information through NASA POWER.
- Explore vegetation conditions using Sentinel-2-derived NDVI when Copernicus credentials and observations are available.
- Inspect daily environmental records for 2025 and compare them with crop growth stages.
- Distinguish observed or modeled data from derived estimates and unavailable information.

### Crop suitability recommendations

CropLite screens **20 crops**:

Wheat, maize, flooded rice, soybean, sorghum, barley, potato, sunflower, dry bean, cabbage, green pea, tomato, oats, peanut, dry onion, sweet pepper, sugar beet, cotton, alfalfa (hay), and melon.

The recommendation engine evaluates historical planting windows using four agronomic dimensions:

| Evaluation dimension | Reference weight |
| --- | ---: |
| Temperature suitability | 30% |
| Growing degree days (GDD) and heat accumulation | 25% |
| Exposure to relevant cold or heat thresholds, when available | 15% |
| Rainfall relative to estimated rainfed crop water demand | 30% |

Weights are adjusted when a valid reference is unavailable. Scores are **relative suitability indicators, not probabilities of successful harvest**.

### Annual crop rotation planning

- Explore sequences of two crops within **one agricultural year**.
- Consider planting and harvest timing, growing-cycle duration, and botanical family diversity.
- Allow at least **14 days of transition** between successive crops as a planning assumption.
- Compare up to three potential sequences where suitable combinations exist.

The planner may return no valid sequence. It does not assume that a rotation guarantees improved fertility, disease control, or profitability. Flooded rice is excluded from rainfed rotation planning.

## How CropLite Works

1. **Select a field.** Outline an agricultural area on the satellite map.
2. **Retrieve environmental context.** The backend queries NASA POWER and, when configured, Copernicus services.
3. **Compare crops.** A rule-based engine evaluates crop requirements against eligible historical climate windows.
4. **Review the results.** Explore ranked crops, supporting explanations, and data limitations.
5. **Plan the year.** Compare possible annual crop sequences and planting dates.
6. **Inspect detailed indicators.** Open the environmental and crop-stage comparisons when more detail is needed.

## Technology Stack

| Layer | Technologies | Role |
| --- | --- | --- |
| Frontend | React, JavaScript, Vite | Interactive web application |
| Interface and maps | CSS, Leaflet, React Leaflet | Responsive layouts, field selection, geographic display |
| Charts and visuals | Recharts, Lucide | Environmental charts and UI elements |
| Backend | Python, FastAPI, Uvicorn | APIs, data processing, agronomic evaluation |
| HTTP and configuration | HTTPX, python-dotenv | External API requests and environment configuration |
| Spatial representation | GeoJSON, WGS84 coordinates | Field boundaries and geographic queries |

### Data sources

| Source | Role |
| --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) | Historical agroclimatic estimates for a representative field location |
| [Copernicus Data Space / Sentinel Hub](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html) | Sentinel-2 observations and historical NDVI over the selected polygon |
| [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) | Satellite imagery basemap |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Alternative reference map |
| [FAO EcoCrop](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en/) and [FAO crop water references](https://www.fao.org/4/s2022e/s2022e07.htm) | Crop requirements, growth-stage coefficients, and agronomic references |

NASA POWER returns gridded climate estimates for a representative location, **not direct measurements of every point inside a field**. Copernicus polygon statistics and vegetation indicators are separate from the satellite basemap.

## Installation

### Requirements

- **Python 3.11+**
- **Node.js 20+** and npm
- Git (optional, for cloning the repository)
- Internet access for dependency installation and external data services
- Copernicus Data Space OAuth credentials for Copernicus-dependent features

### 1. Obtain the project

Clone the repository or download and extract the project ZIP. Open the project root folder in VS Code or a terminal.

Expected structure:

```text
croplite/
├── README.md
├── backend/
│   ├── app.py
│   ├── decision_engine.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .env.example
│   ├── data/
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   ├── src/
│   └── tests/
└── docs/
```

### 2. Start the backend (PowerShell)

From the project root, open **Terminal 1**:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Create the environment file only if it does not already exist.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

The API will run at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

To use Copernicus features, set the following values in `backend/.env`:

```dotenv
CDSE_CLIENT_ID=your-client-id
CDSE_CLIENT_SECRET=your-client-secret
CROPLITE_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Create an OAuth client through the [Copernicus Data Space dashboard](https://shapps.dataspace.copernicus.eu/dashboard/). **Never commit `.env` or credentials to Git.** NASA POWER does not require API credentials.

### 3. Start the frontend (PowerShell)

Open **Terminal 2** at the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173/** in your browser.

In local development, the Vite proxy forwards `/api` requests to `http://127.0.0.1:8000`.

### 4. Run tests and create a production build

Backend (from `backend/`):

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend (from `frontend/`):

```powershell
node --test
npm run build
```

The frontend build is generated in `frontend/dist/`. A public deployment requires separate hosting and production API configuration; the steps above run CropLite locally.

## Scientific Scope and Limitations

CropLite uses a **transparent, rule-based agronomic screening engine**, not a trained machine-learning model.

- Historical climate analogues are used for planning comparisons, **not future weather forecasts**.
- Environmental datasets can contain gaps and have different spatial or temporal resolutions.
- Satellite-derived NDVI describes observed vegetation; it does not identify which future crop will perform best.
- Water-demand comparisons are simplified and do not establish actual irrigation availability or root-zone water balance.
- Field-level soil fertility, detailed soil properties, pests, management practices, and measured yields are not comprehensively represented in the suitability score.
- Annual rotation proposals are preliminary planning options, not validated agronomic prescriptions.

Future research could combine field-verified outcomes, soil and irrigation data, and properly trained and validated machine-learning models. Those methods are **not part of the current recommendation engine**.

## Data Attribution and Responsible Use

CropLite uses external datasets under the terms of their respective providers. Preserve map attributions, review provider conditions before public or commercial deployment, and do not redistribute basemap tiles without permission.

The `docs/` directory includes project reference material and source matrices used to organize agronomic variables.

---

**CropLite — Plan Smarter. Grow Better.**
