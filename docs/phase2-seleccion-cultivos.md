# TerraAI · Selección visual de seis cultivos (iteración enfocada)

## Qué se modificó

- **Overview / My Farm > Analizar región:** reemplazados los campos manuales de umbrales de frío/calor por seis tarjetas con ilustraciones vectoriales locales y nombres. El cultivo seleccionado queda en el estado principal de React.
- **Environment > Temperature Intelligence:** banda sombreada del óptimo climático, líneas de referencia para T basal y superior GDD, frío en floración y calor durante reproducción. Se resaltan puntos de la serie diaria que cruzan estas referencias, **sin calcular riesgos, predicciones, estadísticas adicionales ni diagnósticos de daño**.
- **Datos estructurados:** `frontend/src/data/cropTemperatureCatalog.json` permite ampliar la lista sin duplicar valores en los componentes. Se incluyen enlaces de procedencia por umbral.
- **Sin nuevas consultas por cambio de cultivo:** cambiar de tarjeta cambia inmediatamente las referencias del gráfico; el NDVI, las peticiones NASA POWER, el mapa y el período de fechas siguen intactos.
- No se modificaron los endpoints de FastAPI ni las credenciales Copernicus. El backend conserva métricas existentes por compatibilidad, pero **no se visualizan los recuentos de exposición antiguos**.

## Valores incluidos (°C)

| Cultivo | Basal GDD (CSV) | Superior GDD (CSV) | Óptimo climático orientativo | Referencia calor en reproducción | Frío en floración (referencia de helada) |
|---|---:|---:|---:|---:|---:|
| Trigo | 0 | 35 | 15–23 | 32 | −1 (rango FAO: −2 a −1) |
| Maíz | 10 | 32 | 18–33 | 35 | −1 (−2 a −1) |
| Arroz | 12 | 35 | 25–35 | 35 | −0,5 (−1 a −0,5) |
| Soja | 10 | 40 | 20–33 | 30 | −2 (−3 a −2) |
| Sorgo | 10 | 30 | 24–35 | 37,4 | −1 (−2 a −1) |
| Cebada | 0 | 30 | 15–20 | 30 | −1 (−2 a −1) |

### Fuentes y limitaciones (muy importante)

- **T basal y T superior para GDD:** archivo aportado por el proyecto `TerraAI_20_Cultivos_Indicadores_Satelitales(1).csv`. Estos valores son parámetros de cálculo, **no** límites de daño.
- **Rangos climáticos orientativos:** [FAO ECOCROP](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en) y sus reproducciones en [Agronomy 2026](https://www.mdpi.com/2073-4395/16/8/829) (trigo, maíz, sorgo, cebada), [FAO ECOCROP/Crop Potential Productivity Index](https://ageconsearch.umn.edu/record/365817) (arroz), y [CIREN–ODEPA Chile, sección soja](https://www.odepa.gob.cl/wp-content/uploads/2010/08/mapasProduccionBiocombustibles.pdf) (soja). ECOCROP define rangos para condiciones climáticas de un cultivo; no son óptimos para **todas** las fases ni necesariamente para temperaturas diarias individuales.
- **Calor durante reproducción:** [Journal of Experimental Botany, 2020](https://academic.oup.com/jxb/article/71/2/555/5574893), tabla comparativa de temperaturas que inducen estrés durante la reproducción (trigo, arroz, soja, sorgo, cebada); [revisión 2026 sobre maíz](https://pmc.ncbi.nlm.nih.gov/articles/PMC12837853/) (maíz ≈35 °C). Son referencias dependientes de la fase reproductiva, variedad y duración de exposición, no temperaturas letales universales.
- **Frío en floración:** [FAO, *Frost protection: fundamentals, practice, and economics*, tabla 4.5](https://www.fao.org/4/y7223e/y7223e0a.htm) muestra rangos para los seis cultivos, derivados de una tabla histórica de 1958 y coincidentes con los valores del CSV. Para la línea visual se toma el extremo más alto del rango como **referencia orientativa**, sin afirmar que daño inevitablemente ocurre cuando baja de ese nivel.
- **NASA POWER** suministra estimaciones meteorológicas regionales de temperatura del aire, no temperatura del tejido vegetal. No se conoce la fase fenológica del cultivo; **el gráfico no evalúa la aptitud ni demuestra daño**.

## Instalación en VS Code (Windows)

La entrega es un ZIP de proyecto actualizado y un parche Git generado sobre la versión **TerraAI Fase 1 Mapa Único**.

1. Haz una copia de tu repositorio antes de combinar cambios, y revisa `git status`.
2. Guarda el parche `TerraAI_6_Cultivos_Comparacion_Visual.patch` en Descargas y sitúate en la raíz de `NasaSpaceAppsChallenge`.
3. Ejecuta `git apply --check "$env:USERPROFILE\Downloads\TerraAI_6_Cultivos_Comparacion_Visual.patch"`.
4. Solo si no hay errores ejecuta `git apply "$env:USERPROFILE\Downloads\TerraAI_6_Cultivos_Comparacion_Visual.patch"`.
5. Reinicia `frontend` con `npm.cmd install` y `npm.cmd run dev`. Reinicia el backend como siempre; no es necesario cambiar `.env`.
6. Comprueba: selección de seis tarjetas → región → análisis → Environment → líneas según cultivo; cambia de cultivo y verifica que los resultados ambientales permanecen.

Si tu versión local difiere de **Fase 1**, `git apply --check` puede fallar. No fuerces el parche. Utiliza el ZIP como base de comparación.

## Pruebas

- `cd backend && pytest -q` para la suite backend existente.
- `cd frontend && node --test tests/crop-temperature.test.mjs` para el catálogo y verificaciones de integración estática.
- El build completo de Vite y pruebas de llamadas NASA/Copernicus requieren dependencias y conectividad; no deben declararse exitosas sin haberlas ejecutado.
