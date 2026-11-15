# CropLite

**Explorador satelital y planificador agrícola anual**  
NASA Space Apps Challenge 2026 — *Adapting Farms with NASA Data*

CropLite permite delimitar un campo sobre un mapa con **imágenes satelitales reales**, consultar datos ambientales históricos, comparar diez cultivos y explorar **rotaciones de dos cultivos dentro de un único año**. Conserva el modelo agroclimático basado en reglas de la versión de TerraAI «Rediseño de decisiones», con la corrección de la selección de historiales extensos que podía producir HTTP 500.

> **Prototipo orientativo:** no es un modelo de IA entrenado ni pronostica rendimientos, daños o resultados futuros. Las fechas agrícolas usan escenarios de planificación contrastados con climas históricos; no se simula el tiempo del año futuro.

## Identidad visual y rediseño integral (noviembre de 2026)

La identidad aprobada es **CropLite**: emblema circular con surcos, arco orbital y señal de satélite. El símbolo y el wordmark proceden de **la imagen del logo aprobada por el equipo**, convertida a rutas SVG con sus formas originales y limitada a las dos tintas de marca. No se ha sustituido el emblema ni se ha recompuesto el nombre con una tipografía aproximada.

- **Solo dos tintas en la iconografía de marca:** verde bosque `#103D28` y verde oliva `#8FAA5A`. Los neutros `#FAF8F3`, `#FFFFFF`, `#E9EDE5` y `#25332B` se usan únicamente como superficie, separación y texto. Los gráficos pueden mantener tonos adicionales si representan variables diferentes o avisos científicos.
- **Archivos de marca:** `frontend/public/brand/croplite-symbol.svg`, `croplite-horizontal.svg`, `croplite-badge.svg` (variante sobre fondo oscuro) y `croplite-app.svg` (favicon); componente reutilizable `src/components/ui/CropLiteBrand.jsx`.
- **Diez ilustraciones de cultivos originales restauradas:** `frontend/public/crops/*.svg` coincide con la versión previa al rediseño de marca; se conserva el componente `src/components/crops/CropIcon.jsx` para recomendaciones, selectores y calendarios.
- **Sistema de diseño compartido:** `frontend/src/brand-system.css` agrupa tokens, tipografía, espaciados, estados interactivos, tablas, paneles y puntos de quiebre; se carga después de la hoja de compatibilidad `styles.css` para preservar la funcionalidad existente.
- **Diseño adaptable:** mapa y tarjetas refinados, navegación lateral con menú táctil en pantallas pequeñas, foco visible, tamaño de controles apropiado, desplazamiento de tablas y opciones para movimiento reducido.
- **Inteligencia agrícola sin cambios:** no se tocaron el backend, las fuentes NASA/Copernicus, la puntuación agronómica, la línea temporal fenológica ni el cálculo de rotaciones. La versión vigente **planifica rotaciones anuales de dos cultivos**, tal como se había definido anteriormente, y no vuelve a introducir planes de tres años.

## Qué cambió en la versión satelital (base)

1. **Nuevo nombre: CropLite.** Título, identidad principal, API y nombre del paquete frontend.
2. **Layout inspirado en una plataforma de monitoreo agrícola:** barra superior compacta, mapa protagonista, buscador y edición de parcelas sobre la imagen, fichas de estado bajo el mapa y navegación derecha hacia secciones realmente existentes. Conserva la paleta verde, los fondos claros y las tarjetas limpias de la versión anterior. Responsive en móvil.
3. **Mapa satelital auténtico:** `FieldSelectionMap.jsx` muestra por defecto **Esri World Imagery** mediante teselas geográficas, con atribución en Leaflet. El usuario puede alternar con OpenStreetMap. Es un mosaico multifecha: **no es una imagen de la fecha de hoy, una captura específica de Sentinel‑2, un índice NDVI ni un pronóstico**. Su resolución y antigüedad varían por lugar. El polígono del campo sigue siendo editable en GeoJSON (WGS84).
4. **Planificación de un año:** ahora el motor compone planes con **dos especies sucesivas** cuyas fechas completas de siembra y cosecha caen en el mismo año calendario. Exige familias botánicas diferentes, sin solapamiento y **al menos 14 días de transición** (supuesto configurable; no regla agronómica universal). Muestra hasta tres alternativas de secuencias distintas. Puede no haber ninguna cuando los ciclos no caben, y lo comunica sin inventar fechas.
5. **Sin gráfico “Por qué se recomienda”:** se eliminó el gráfico de temperatura/lluvia de la sección de decisiones. Se conserva un resumen textual de razones del ranking y la metodología desplegable para mantener la transparencia científica.
6. **Diez cultivos y motor de cuatro dimensiones:** trigo, maíz, arroz, soja, sorgo, cebada, papa, girasol, poroto seco y repollo. Las cuatro últimas especies provienen del Excel original incluido en `docs/source/`.
7. **Regresión HTTP 500 corregida** en `selected_history_years()` para historiales de más de doce años disponibles.

## Cómo se usa

1. Abre la web y busca tu localidad o navega sobre el mapa satelital.
2. Haz clic en **Dibujar campo**, marca tres o más vértices, **Confirmar campo**; después podrás editarlo, redibujarlo o eliminarlo.
3. El sistema solicita NASA POWER y contexto Copernicus desde FastAPI. El mapa base funciona de forma independiente de las credenciales Copernicus, aunque necesita acceso a internet y que el proveedor de teselas esté disponible.
4. En **Recomendaciones**, consulta seis alternativas de entrada y pulsa **Ver los 10 cultivos** si necesitas ampliar el ranking. Al seleccionar una especie, se actualizan sus razones textuales.
5. En **Rotación anual**, compara hasta tres planes de dos cultivos con su calendario de enero a diciembre. No se ofrecen planes si no hay compatibilidad de fechas.
6. En **Datos ambientales**, revisa los registros diarios de 2025 y una fenología orientativa. Esta sección se refiere a 2025, no al año de planificación de las rotaciones.

## Instalación — Windows / VS Code

Requisitos: **Python 3.11+**, **Node.js 20+**, npm, conexión a internet para instalar dependencias y consultar datos. Descomprime el ZIP y abre la carpeta `croplite` en VS Code.

### Terminal 1 — FastAPI

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

Si ya tienes el archivo `backend/.env` de TerraAI, **conserva el existente** en vez de copiar encima `.env.example`. Las credenciales originales de Copernicus siguen siendo compatibles. Se admite tanto `CROPLITE_ALLOWED_ORIGINS` como el nombre anterior `TERRAAI_ALLOWED_ORIGINS`, por compatibilidad. Para la consulta NASA POWER no se necesita credencial.

### Terminal 2 — React

```powershell
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173/`. El proxy de Vite dirige `/api` a `http://127.0.0.1:8000`.

### Pruebas automatizadas

```powershell
# Desde backend: primero instala las dependencias de desarrollo
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q

# Desde frontend
node --test tests/*.mjs
npm run build
```

**Verificación del rediseño:** las 57 pruebas de FastAPI y las pruebas Node del frontend fueron ejecutadas correctamente. Los SVG fueron validados como XML y el código JS/JSX se analizó con el parser de TypeScript. La compilación Vite no pudo ejecutarse aquí porque npm no completó la instalación de dependencias de red en el plazo de prueba; ejecútala localmente con `npm install && npm run build`. No sustituye la prueba de navegador real.

## Motor de recomendaciones

`backend/decision_engine.py` evalúa la compatibilidad en ventanas hipotéticas de siembra cada 14 días, mediante hasta 12 años históricos elegibles. Los criterios actualmente ponderados son:

| Dimensión | Peso de referencia |
|---|---:|
| Temperatura dentro de banda general del cultivo | 30 % |
| GDD / calor acumulado frente a ciclo | 25 % |
| Exposición a referencias de frío/calor cuando se dispone de umbral válido | 15 % |
| Lluvia frente a demanda ETc orientativa en secano, incluidos Kc por etapa | 30 % |

Los pesos se renormalizan cuando la referencia térmica de exposición no es evaluable. El indicador robusto combina un 60 % del percentil 25 y un 40 % del promedio de puntuaciones históricas; **no es probabilidad de éxito**. La radiación y otros datos pueden contribuir a ET₀ y ser contexto, pero no se puntúan de manera independiente si faltan umbrales validados. pH, fertilidad, capacidad real de retención de agua y riego no medidos **no se inventan ni se incluyen** en la puntuación.

Las rotaciones anuales también consideran el cambio de familia, el calendario y (solo como desempate) la presencia de leguminosas y diferencias referenciales de profundidad de raíces. **No cuantifican fijación de nitrógeno, sanidad del suelo ni rentabilidad.** El arroz inundado queda excluido del planificador de secano.

## Datos y licencias

| Fuente | Uso |
|---|---|
| [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) | Imagen satelital geográfica de fondo; mosaico multifecha, no un producto fenológico ni temporal |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Mapa alternativo de calles |
| [NASA POWER](https://power.larc.nasa.gov/) | Series meteorológicas en un punto representativo del campo; estimaciones espaciales de baja resolución relativa |
| [Copernicus Data Space / Sentinel Hub](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html) | NDVI histórico del polígono cuando hay credenciales configuradas |
| [FAO EcoCrop / FAO-56](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en/) | Parámetros del catálogo de cultivos |

La capa de World Imagery requiere atribución, y el acceso/uso está sujeto a las condiciones del proveedor. Para un despliegue público o comercial, **verifica la licencia aplicable a tu proyecto** y utiliza un servicio de mapas con permisos de uso apropiados. No descargues masivamente ni redistribuyas las teselas. La atribución se muestra en el mapa.

La carpeta `docs/source/` conserva las matrices originales con sus nombres históricos para la trazabilidad de las variables. Los catálogos de cultivos están en `backend/data/` y `frontend/src/data/`.

## Arquitectura

```text
croplite/
├── README.md
├── backend/
│   ├── app.py                           # FastAPI y endpoints
│   ├── decision_engine.py               # Ranking + rotación anual
│   ├── decision_history_service.py      # Históricos independientes
│   ├── data/                             # Catálogos agronómicos
│   ├── .env.example                     # Variables sin credenciales
│   └── tests/
├── frontend/
│   ├── index.html
│   ├── public/brand/                    # Logo, emblema y favicon SVG
│   ├── public/crops/                    # 10 ilustraciones originales restauradas
│   ├── src/
│   │   ├── App.jsx                     # Shell CropLite + navegación derecha
│   │   ├── styles.css                  # Estilos existentes para compatibilidad
│   │   ├── brand-system.css            # Tokens y componentes del nuevo diseño
│   │   ├── components/ui/CropLiteBrand.jsx
│   │   ├── components/crops/CropIcon.jsx
│   │   ├── components/maps/FieldSelectionMap.jsx
│   │   ├── components/recommendations/AgriculturalDecisions.jsx
│   │   ├── components/recommendations/decisionInsights.mjs
│   │   └── components/historical/       # Datos diarios de 2025
│   └── tests/
└── docs/source/                        # Archivos originales con procedencia
```

## Errores frecuentes

- **HTTP 500**: revisa el detalle en la terminal de Uvicorn; la corrección de historiales largos está incorporada, pero otros problemas de las APIs externas siguen siendo posibles.
- **Mapa sin imágenes**: prueba el botón **Calles**. Comprueba acceso a internet y restricciones al servidor de World Imagery. El mapa no depende del proxy NASA ni de Copernicus.
- **Datos incompletos**: la app evita inventar observaciones y avisa cuando faltan históricos.
- **Copernicus sin configurar**: la imagen satelital base puede verse igualmente; el NDVI específico del polígono requiere credenciales y consultas separadas.
- **No hay rotaciones**: no es necesariamente un fallo; puede que ninguna pareja elegible complete ambos ciclos dentro del mismo año con el intervalo mínimo.

**Referencias externas:** [NASA POWER](https://power.larc.nasa.gov/), [ESA Copernicus](https://documentation.dataspace.copernicus.eu/), [FAO EcoCrop](https://www.fao.org/geospatial/data-and-tools/data-portals/ecocrop/en/), [atribución Esri](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040).
