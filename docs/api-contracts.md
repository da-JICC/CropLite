# TerraAI · anticipated API contract (planning only)

This is a **future interface specification**, not an implemented API. Backend choice: Python / FastAPI, with a modular monolith and potential PostgreSQL/PostGIS storage. Responses below are indicative and may change after dataset selection.

All future endpoints should include source provenance, measurement date, units, region and quality/uncertainty flags. Do not treat `demo` records as observations.

## Envelope (recommended)

```json
{
  "data": {},
  "metadata": {
    "status": "simulated | observed | forecast | hypothetical",
    "source": "source identifier or mock profile",
    "updated_at": null,
    "spatial_resolution": null,
    "temporal_resolution": null,
    "units": {},
    "uncertainty": null
  }
}
```

## Planned read endpoints

| Endpoint | Query | Main JSON structure |
|---|---|---|
| `GET /api/farms` | none | `[{id,name,region,lat,lng,hectares,soil,irrigation,history}]` |
| `GET /api/environmental-conditions` | `farm_id`, `period` | `{monthly:[{month,moisture,rain,temp,ndvi,et}],summary:{frost,heat,erosion,waterBalance}}` |
| `GET /api/soil` | `farm_id` | `{soil,texture,ph,organicMatter,soilConcern}` |
| `GET /api/crops` | `region_id` | `[{id,name,category,water,season,roots,nitrogen,erosion,drought,market}]` |
| `GET /api/rotations` | `farm_id` | `[{id,title,focus,crops:["crop_id",...]}]` |
| `GET /api/rotation-comparisons` | `farm_id`, `priority`, `horizon` | `[{id,soil,water,nutrients,erosion,drought,market,forage,implementation,benefit,tradeoff,why}]` |
| `GET /api/predictions` | `farm_id`, `horizon`, `scenario` | `{kind,label,horizons,moistureReference,moistureDry,unit,hasValidatedUncertainty}` |
| `GET /api/recommendations` | `farm_id` | `[{id,title,kind,severity,reason,variables,benefit,risk,uncertainty,strategy}]` |
| `GET /api/reports` | `farm_id` | `{farmId,sections,exportFormats,dataStatus}` |
| `GET /api/sources` | none | `[{id,name,institution,variables,application,url,status,category}]` |

## Example: `GET /api/rotation-comparisons?farm_id=casablanca`

```json
{
  "data": [
    {
      "id": "A", "title": "Current rotation", "focus": "Existing practice",
      "crops": ["wheat", "oats", "wheat", "oats"],
      "soil": 43, "water": 70, "drought": 38,
      "benefit": "Uses familiar crops and equipment.",
      "tradeoff": "Repeated cereals can limit nitrogen diversification."
    }
  ],
  "metadata": {
    "status": "simulated",
    "source": "TerraAI demonstration profile",
    "updated_at": null,
    "units": { "soil": "illustrative index / 100", "water": "illustrative demand / 100" },
    "uncertainty": "Not estimated"
  }
}
```

`src/services/dataService.js` is currently the **only file that imports mock JSON directly**. When the backend is implemented, refactor service methods to fetch typed responses and retain the same presentation data contract.

## Planned protections

- Validate coordinates and permitted geographic extents; support region-aware crop filtering.
- Link every observed series to product ID, date range, provider, processing version, units, spatial resolution and quality flags.
- Do not merge satellite, station and model output without labels and provenance.
- Define security, authentication and rate limits before enabling user accounts, farm uploads or report sharing.
- Mark forecasts with calibrated uncertainty, issuance time and validity period once real models exist.
