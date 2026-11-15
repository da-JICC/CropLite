# TerraAI · Fase de indicadores agrícolas diarios de 2025

## ¿Qué se implementó?

Esta versión **mantiene el mapa y las herramientas geográficas originales**. Después de delimitar un polígono, el frontend solicita `POST /api/regions/environment/daily-2025` con `{"polygon": <GeoJSON>}`. El servidor establece **2025-01-01 / 2025-12-31**, sin ingreso manual de fechas. Mantiene 365 fechas en cada serie, usando `null` en observaciones faltantes. Cambiar de variable o cultivo no vuelve a consultar las APIs.

**Variables ambientales**: temperatura media, mínima y máxima, humedad relativa, precipitación NASA POWER, precipitación multisatélite GPM IMERG, radiación solar, viento, presión, humedad del suelo superficial y radicular (SMAP L4 por POWER HY), NDVI, NDMI. Se incluyen además VPD, ET₀ FAO-56 y precipitación acumulada, y tres series calculadas según el cultivo: GDD diario, ETc **solo como escenario con Kc de etapa media** y balance **parcial** P–ETc de ese escenario.

La selección visual mantiene seis cultivos (trigo, maíz, arroz, soja, sorgo y cebada). La matriz `backend/data/crop_agronomic_parameters.json` contiene **20 cultivos** y deja `null` para requisitos sin respaldo verificado. El catálogo se genera desde el CSV entregado por el usuario y se complementa con rangos de duración de ciclos publicados por FAO; no presume fecha de siembra, variedad o fenología.

## Cómo iniciar en Windows (desde la carpeta raíz)

1. **Conserva** las credenciales en `backend/.env`. No las subas a Git ni al ZIP.
2. Terminal A, backend:
   ```powershell
   cd backend
   # Si ya existe el entorno virtual:
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
   ```
   Si `.venv` no existe en esta copia, crea uno con `py -m venv .venv`.
3. Terminal B, frontend:
   ```powershell
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```
4. Abre `http://localhost:5173` y dibuja el polígono. En el Explorador ambiental aparecen las pestañas con las variables diarias y los indicadores.
5. Pruebas backend desde la raíz: `python -m pytest backend/tests -q` (requiere `pytest`, `httpx`, `fastapi`); pruebas estructura frontend: `node --test frontend/tests/*.test.mjs`.

## Enlaces científicos y notas

| Indicador / variable | Procedimiento | Advertencia |
|---|---|---|
| VPD | FAO-56: `e_s=(e°(Tmax)+e°(Tmin))/2`, `e_a=e°(Tdew)`, `VPD=max(0,e_s-e_a)` | Estimación de medias diarias; no es VPD de máxima demanda horaria |
| ET₀ | Penman–Monteith FAO-56 con T, Tdew, Rs, u2, PS, latitud y día del año | La elevación se aproxima a partir de PS; no es ET real |
| GDD | `max(0,min(Tmean,Tupper)-Tbase)` | No corresponde al ciclo del cultivo sin fecha de siembra |
| ETc | `ET₀ × Kc_mid` | **Escenario únicamente**; no atribuir a campo real sin fase de desarrollo |
| P–ETc | `PRECTOTCORR – ETc_escenario` | No es estrés hídrico ni balance del suelo; no incluye riego, drenaje o reservorios |
| NDVI | `(B08–B04)/(B08+B04)` | No se interpola entre sobrevuelos; solo máscara SCL 4/5 |
| NDMI | `(B08–B11)/(B08+B11)` | Mide humedad espectral de vegetación, **no** contenido de agua en suelo |
| SMAP | `SFMC`, `RZMC` en m³/m³ | Estimación regional ~9 km; no determina agua disponible sin capacidad de campo |

- FAO Penman–Monteith: https://www.fao.org/4/X0490E/x0490e06.htm
- FAO humedad/VPD: https://www.fao.org/4/x0490e/x0490e07.htm
- FAO Kc, ETc y ciclos: https://www.fao.org/4/s2022e/s2022e07.htm
- NASA POWER HY: https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/
- NASA GPM IMERG: https://gpm.nasa.gov/data/imerg
- Copernicus Statistical API: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html
- NDMI: https://environment.data.gov.uk/natural-capital-ecosystem-assessment/search/c35ff54e-0633-4b52-b053-e380d557cc62
- Soil field capacity: https://www.nrcs.usda.gov/sites/default/files/2022-10/nrcs142p2_051590.pdf

## Tres matrices entregadas

- `docs/01_matriz_cultivos.csv` (20 cultivos y referencias disponibles)
- `docs/02_matriz_fuentes.csv` (identificador, unidades, disponibilidad y origen)
- `docs/03_matriz_indicadores.csv` (dependencias, fórmulas, calculabilidad y limitaciones)
- Archivo Excel externo `TerraAI_Tres_Matrices_Agricolas_2025.xlsx` con las tres matrices y bibliografía.

## Precauciones científicas

**No hay datos de 2025 precargados ni inventados.** Las consultas se realizan en vivo para el polígono seleccionado, porque sin sus coordenadas no es posible extraer resultados del terreno. Las respuestas de cada fuente pueden fallar independientemente.

No se calcula estrés hídrico real, daño térmico confirmado, ni aptitud del cultivo porque faltarían fecha de siembra, etapa fenológica, suelo local (capacidad de campo, punto de marchitez), riego y/o umbrales validados por variedad. Un cruce diario de referencia se marca como **alerta visual condicionada**; no prueba estrés o pérdidas.

**IMPORTANTE**: las pruebas automatizadas utilizan mocks de las APIs; no certifican disponibilidad en vivo. Se debe revisar en el ordenador del usuario la compilación completa de Vite y las consultas reales. Límite de coste: esta versión hace hasta 12 solicitudes Copernicus (una por mes) con `P1D` para obtener ambos índices en una misma consulta, más solicitudes independientes a NASA POWER. La cobertura diaria óptica puede ser escasa por nubes.
