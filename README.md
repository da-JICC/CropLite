# TerraAI — Field Shift

**Plataforma de apoyo a decisiones agrícolas con observación terrestre**  
**NASA Space Apps Challenge 2026 · Adapting Farms with NASA Data**

TerraAI permite delimitar un terreno agrícola, consultar información ambiental de NASA y Copernicus, explorar el desarrollo estimado de seis cultivos y comparar alternativas de siembra y rotación. Combina observaciones de vegetación, estimaciones meteorológicas, parámetros agronómicos y un **motor de reglas explicable**.

> **Estado del proyecto:** prototipo de investigación y apoyo exploratorio. El motor de decisiones **no es un modelo de IA entrenado**, y sus puntuaciones no representan probabilidad de supervivencia, rendimiento esperado ni garantía de cosecha. La consulta en vivo depende de las APIs y de la configuración local.

## Contenido

- [Qué hace TerraAI](#qué-hace-terraai)
- [Tecnologías y organización](#tecnologías-y-organización)
- [Instalación en Windows y VS Code](#instalación-en-windows-y-vs-code)
- [Cómo utilizar la aplicación](#cómo-utilizar-la-aplicación)
- [Fuentes de datos y períodos](#fuentes-de-datos-y-períodos)
- [Metodología agronómica y recomendaciones](#metodología-agronómica-y-recomendaciones)
- [API y componentes principales](#api-y-componentes-principales)
- [Pruebas y solución de problemas](#pruebas-y-solución-de-problemas)
- [Limitaciones y próximos pasos](#limitaciones-y-próximos-pasos)
- [Referencias](#referencias)

## Qué hace TerraAI

La versión documentada aquí organiza la experiencia en una **página principal**, sin navegación lateral obligatoria, con estos bloques:

1. **Área de estudio.** Un mapa Leaflet permite dibujar, editar y eliminar el polígono agrícola. La selección se conserva como geometría GeoJSON (WGS84); se calcula el área y un punto representativo para las consultas meteorológicas.
2. **Decisiones agrícolas.** Presenta las alternativas de trigo, maíz, arroz, soja, sorgo y cebada, con puntuaciones relativas, explicaciones comprensibles, evidencia estacional de temperatura y lluvia, y hasta tres propuestas de rotación de dos cultivos. Las explicaciones y gráficas cambian al seleccionar una alternativa.
3. **Ambiente y calendario del cultivo.** Muestra **datos diarios de 2025** en un gráfico con siete pestañas: temperatura, humedad atmosférica, precipitación, radiación solar, viento, presión atmosférica y humedad del suelo. Hay un solo gráfico visible a la vez.
4. **Fenología e indicadores.** El usuario selecciona uno de los seis cultivos y una fecha de siembra en 2025. Se muestran cuatro etapas del ciclo sobre el gráfico y en una línea temporal, junto a indicadores por etapa como GDD, ET₀, ETc orientativa, lluvia y referencias de frío cuando están disponibles.

Cambiar el cultivo, la fecha de siembra o la pestaña de una gráfica **reutiliza los datos ya obtenidos**, sin realizar automáticamente una nueva descarga. Al seleccionar o modificar el terreno se solicitan las series correspondientes a esa región.

### Cultivos incorporados

| Cultivo | Identificador habitual | Consideraciones |
|---|---|---|
| Trigo | `wheat` | Cereal; requerimientos y etapas dependen de la variedad y temporada. |
| Maíz | `maize` | Cereal; atención a acumulación térmica y etapas reproductivas. |
| Arroz | `rice` | El escenario de arroz inundado requiere un manejo hídrico particular. |
| Soja | `soybean` | Leguminosa; familia diferente de los cinco cereales listados. |
| Sorgo | `sorghum` | Cereal; sensibilidad climática y duración según variedad. |
| Cebada | `barley` | Cereal; condiciones y calendario particulares por variedad. |

Los parámetros térmicos y fenológicos están en los catálogos de `frontend/src/data/`. El archivo original de **20 cultivos** se utilizó como referencia para las primeras matrices; solo estos seis están habilitados en las tarjetas actuales.

## Tecnologías y organización

- **Frontend:** React 18, Vite 5, Tailwind CSS, Leaflet/React-Leaflet, Recharts y Lucide.
- **Backend:** Python, FastAPI, HTTPX y Uvicorn.
- **Datos:** NASA POWER, productos hidrológicos accesibles por POWER, y Copernicus Sentinel-2 L2A mediante Sentinel Hub Statistical API.
- **Formato geográfico:** GeoJSON en coordenadas WGS84.

Estructura simplificada de la versión actual:

```text
terra-ai/
├── README.md                         # Documentación principal: este archivo
├── frontend/
│   ├── package.json
│   ├── vite.config.js                 # Proxy /api → http://127.0.0.1:8000
│   ├── public/crops/                 # Ilustraciones SVG de los seis cultivos
│   ├── src/
│   │   ├── App.jsx                   # Página única y estado de la región
│   │   ├── components/
│   │   │   ├── maps/FieldSelectionMap.jsx
│   │   │   ├── recommendations/
│   │   │   │   ├── AgriculturalDecisions.jsx
│   │   │   │   └── decisionInsights.mjs
│   │   │   ├── historical/Daily2025Explorer.jsx
│   │   │   └── phenology/
│   │   │       ├── CropPhenologyPanel.jsx
│   │   │       ├── phenologyEngine.mjs
│   │   │       └── indicatorComparisons.mjs
│   │   ├── data/                     # Catálogos térmicos y fenológicos
│   │   └── services/                 # Clientes HTTP del frontend
│   └── tests/
├── backend/
│   ├── app.py                        # FastAPI y rutas
│   ├── .env.example                  # Plantilla sin credenciales reales
│   ├── requirements.txt
│   ├── copernicus.py                 # Cliente Sentinel Hub
│   ├── earth_observation_service.py  # Obtención de productos NASA POWER
│   ├── daily2025_service.py          # Series e indicadores diarios de 2025
│   ├── decision_history_service.py   # Descarga histórica para decisiones
│   ├── decision_engine.py            # Reglas, ranking y rotaciones
│   ├── agroclimate.py                # Cálculos agroclimáticos
│   ├── data/                         # Matrices y catálogos de parámetros
│   └── tests/
└── docs/                              # Referencias y matrices técnicas
```

**Nota sobre versiones:** este README describe la entrega más reciente, **TerraAI — Rediseño de Decisiones agrícolas UX**. Algunas carpetas contienen componentes heredados de etapas previas; su presencia no significa que sigan apareciendo como páginas activas. Si tu repositorio local difiere de esa entrega, comprueba sus archivos antes de trasladar instrucciones o aplicar parches.

## Instalación en Windows y VS Code

### Requisitos

- Windows con PowerShell y Visual Studio Code.
- Python 3 con `py` y capacidad de crear un entorno virtual.
- Node.js y npm.
- Git (recomendado para control de versiones).
- Conexión a internet para consultar las fuentes externas.
- Credenciales OAuth de **Copernicus Data Space / Sentinel Hub** si quieres obtener NDVI real.

Abre en VS Code la **raíz del repositorio que contiene `backend/` y `frontend/`**. Por ejemplo:

```powershell
cd "C:\Users\ASUS\Desktop\Space apps\NasaSpaceAppsChallenge"
```

### 1. Configurar Copernicus

En la carpeta `backend`, crea un archivo local `.env` a partir de `.env.example`. Completa tus credenciales privadas:

```dotenv
CDSE_CLIENT_ID=tu_client_id
CDSE_CLIENT_SECRET=tu_client_secret
TERRAAI_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Obtén las credenciales en el panel de Sentinel Hub de Copernicus Data Space. **Nunca publiques `backend/.env`, tokens ni contraseñas en GitHub o en un ZIP compartido.** NASA POWER no requiere estas credenciales. Si Copernicus no está configurado, otras consultas ambientales pueden funcionar independientemente.

### 2. Iniciar el backend (terminal 1)

Desde la raíz del proyecto:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

Crea `.venv` solamente si aún no existe. Mantén esta terminal abierta. La dirección local del backend es `http://127.0.0.1:8000`; comprueba su estado en `http://127.0.0.1:8000/api/status`.

### 3. Iniciar el frontend (terminal 2)

En una segunda terminal, desde la raíz del proyecto:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abre la dirección mostrada por Vite, normalmente **http://localhost:5173/**. En PowerShell, utiliza `npm.cmd` si `npm` produce un error de ejecución bloqueada de `npm.ps1`.

### 4. Comprobar funcionamiento

1. Verifica que el frontend cargue y el estado del backend indique conexión.
2. Dibuja y confirma un polígono en **Área de estudio**.
3. Comprueba que se cargue **Decisiones agrícolas** y que cada tarjeta de cultivo muestre un análisis distinto.
4. Revisa la gráfica estacional y las alternativas de rotación propuestas, si existen.
5. Baja a **Ambiente y calendario**: cambia entre las siete pestañas de datos diarios y selecciona una fecha de siembra de 2025.
6. Comprueba que las etapas, los indicadores y sus referencias cambien sin perder la selección geográfica.

La primera recuperación de un histórico de varias décadas puede ser lenta y está sujeta a disponibilidad y cuotas de cada proveedor.

## Cómo utilizar la aplicación

### Decisiones agrícolas

Después de confirmar el polígono, TerraAI consulta datos históricos y aplica reglas de compatibilidad climática para ordenar los seis cultivos. Cada tarjeta permite seleccionar el cultivo y ver **por qué** obtuvo su posición, con frases resumidas y un gráfico de contexto estacional. El gráfico de decisiones ofrece vistas de temperatura y lluvia; sus referencias están relacionadas con el cultivo seleccionado.

Las **rotaciones** proponen, cuando es posible, dos cultivos sucesivos con calendarios compatibles y familias botánicas distintas. El orden de siembra puede diferir del ranking individual: la evaluación de una secuencia considera **los dos ciclos**, sus ventanas climáticas, la transición y la puntuación conjunta, no solamente la posición del primer cultivo.

### Ambiente y calendario de 2025

Este módulo trabaja con **el año completo, del 1 de enero al 31 de diciembre de 2025**. La fecha de siembra sí se puede modificar dentro de ese año, pero las fechas de las observaciones ambientales no necesitan introducirse manualmente. Las cuatro fases orientativas son **inicial, desarrollo, mitad de temporada y final/maduración**.

Las franjas de color del gráfico y la línea de tiempo representan **fechas fenológicas estimadas según duraciones de referencia**. No equivalen a una observación satelital que confirme germinación, floración o madurez real. Si un ciclo continúa en 2026, se muestra su finalización estimada, pero no se generan mediciones ni indicadores posteriores al 31 de diciembre de 2025.

La tabla por etapa presenta los indicadores calculables y señala días sin datos. Una diferencia entre lluvia y ETc se denomina **balance climático simplificado** y no diagnostica por sí sola déficit hídrico real.

## Fuentes de datos y períodos

Existen **dos horizontes temporales distintos por diseño**: el motor de decisiones consulta antecedentes históricos amplios; el módulo de inspección agrícola muestra los días de **2025**. No deben confundirse.

| Variable o producto | Fuente | Período usado por el proyecto | Observaciones |
|---|---|---|---|
| Temperatura, humedad relativa, viento, presión y lluvia meteorológica | NASA POWER Daily, comunidad AG | Histórico solicitado desde 1981 hasta 2025; y diario 2025 | Estimaciones meteorológicas para un punto representativo del polígono, no lecturas dentro de cada parcela. |
| Radiación solar | NASA POWER Daily | Histórico solicitado desde 1984; y diario 2025 | Producto de radiación; disponibilidad independiente de meteorología. |
| Precipitación satelital | GPM IMERG mediante NASA POWER HY, cuando está disponible | Histórico desde aproximadamente 2000 y diario 2025 | Producto con referencia temporal y resolución distintas de la lluvia meteorológica de POWER. |
| Humedad superficial y de zona radicular | NASA POWER HY (`SFMC`, `RZMC`), cuando está disponible | Histórico desde aproximadamente 2015 y diario 2025 | Estimaciones regionales; confirmar el producto devuelto antes de atribuirlo específicamente a SMAP L4. |
| NDVI (y productos espectrales cuando corresponda) | Copernicus Sentinel-2 L2A / Statistical API | Contexto histórico NDVI solicitado desde 2017 hasta 2025; integración diaria de 2025 en backend | Estadísticas sobre el polígono; las nubes y ausencia de sobrevuelos dejan observaciones faltantes. |

Las fechas indicadas son **inicios de consulta del código**, no garantía de cobertura real o de observaciones completas. Las fuentes tienen diferentes resoluciones, métodos y estándares horarios. La información faltante se conserva como ausente; no se interpola ni se sustituye por cero.

En el módulo de 2025 aparecen las siete pestañas ambientales mencionadas. La integración espectral de NDVI/NDMI existe en el backend y otros componentes, pero **no forma parte de esas siete pestañas** en la interfaz diaria de la versión aquí documentada.

## Metodología agronómica y recomendaciones

### Evaluación histórica de cultivos

El motor de `backend/decision_engine.py`:

1. Reúne años históricos con cobertura meteorológica suficiente y **separa 2025** para compararlo como último año completo de referencia.
2. Selecciona internamente **años históricos reales análogos** de condiciones habituales, cálidas y secas. Estas analogías ya no tienen que mostrarse como tres paneles separados en la interfaz.
3. Prueba fechas candidatas de siembra cada **14 días**, respetando el calendario por cultivo y sin aceptar ciclos que excedan el año de planificación.
4. Calcula un índice relativo principalmente con **compatibilidad térmica (45 %), avance térmico frente a GDD (40 %) y referencias térmicas disponibles por etapa (15 %)**, normalizando los pesos cuando faltan referencias comparables.
5. Combina resultados entre escenarios mediante **60 % del peor escenario + 40 % del promedio**. Es una decisión conservadora del prototipo, no una fórmula universal de productividad.
6. Propone hasta **tres rotaciones** de dos cultivos con familias botánicas diferentes, ciclos no superpuestos y **14 días de transición** como supuesto de planificación.

Se requiere cobertura mínima del histórico; si no hay observaciones suficientes, el módulo debe indicar que no puede evaluar, en lugar de inventar puntuaciones. El puntaje actual depende **sobre todo de temperatura y GDD**. Precipitación, VPD, humedad del suelo y ETc complementan la explicación, pero no certifican agua disponible, fertilidad, rendimiento ni viabilidad de una rotación.

**No hay un modelo de machine learning entrenado en esta versión.** Los escenarios son analogías históricas, no predicciones meteorológicas verificadas para el año siguiente.

### Indicadores diarios del cultivo

| Indicador | Base de cálculo | Interpretación y cuidado |
|---|---|---|
| GDD | Temperatura media diaria, temperatura basal y superior del cultivo | Calor acumulado desde la siembra; no indica directamente daño térmico. |
| VPD | Temperaturas y punto de rocío / humedad atmosférica | Estimación diaria de demanda atmosférica, no prueba de estrés de la planta. |
| ET₀ | Penman–Monteith FAO-56 con temperatura, humedad, viento, radiación y presión | Demanda evaporativa de referencia. |
| ETc | ET₀ × Kc de la etapa | Escenario de demanda de agua, condicionado por coeficientes y fenología estimada. |
| Precipitación acumulada | Suma de registros diarios válidos | Los totales con fechas faltantes se consideran parciales. |
| Balance P − ETc | Lluvia acumulada menos ETc estimada | Balance climático descriptivo; excluye riego, escorrentía y reservas del suelo. |
| Frío | Temperaturas mínimas frente a referencias disponibles por etapa | Marca exposición potencial, no daño confirmado. |
| Humedad del suelo | Producto regional de superficie / zona radicular | No equivale a medir agua aprovechable para las raíces de la parcela. |

Los catálogos de cultivos conservan información de temperatura basal y superior, Kc, duraciones de etapas y referencias disponibles. **No se asignan valores inventados a umbrales agronómicos faltantes.**

## API y componentes principales

| Ruta | Propósito |
|---|---|
| `GET /api/status` | Estado del backend y configuración de Copernicus. |
| `POST /api/regions/environment/daily-2025` | Variables e indicadores diarios de 2025 para un polígono. |
| `POST /api/regions/decisions/history` | Histórico meteorológico, clasificación de cultivos y rotaciones. |
| `POST /api/regions/decisions/ndvi-history` | Contexto histórico NDVI del polígono. |
| `POST /api/regions/environment` | Consulta multifuente histórica general, mantenida por compatibilidad. |
| `POST /api/regions/analyze` | Análisis combinado de NDVI y temperatura, mantenido por compatibilidad. |
| `POST /api/ndvi` | Estadística NDVI original. |
| `GET /api/climate/temperature` | Serie de temperatura NASA POWER. |
| `GET /api/climate/temperature-summary` | Resumen térmico. |
| `GET /api/climate/gdd` | Cálculo térmico por parámetros. |

Las consultas principales de la página única reciben una geometría de polígono GeoJSON en el cuerpo JSON, habitualmente bajo la clave `polygon`. Los contratos específicos se encuentran en los archivos de servicios y modelos del backend. El frontend utiliza el proxy de Vite para enrutar `/api` hacia `http://127.0.0.1:8000`.

## Pruebas y solución de problemas

### Verificación local

En `backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install pytest
.\.venv\Scripts\python.exe -m pytest -q
```

En `frontend`:

```powershell
node --test tests/*.test.mjs
npm.cmd run build
```

Si tu versión de PowerShell no expande el patrón `tests/*.test.mjs` en Node, ejecuta los archivos `.test.mjs` individualmente o utiliza un entorno que admita ese patrón.

Las entregas anteriores informaron pruebas unitarias y verificaciones estáticas exitosas. **Esto no sustituye un build completo de Vite ni una prueba de extremo a extremo con APIs reales sobre tu terreno.** No se incluyen respuestas satelitales reales precalculadas en este README.

### Problemas frecuentes

| Problema | Qué revisar |
|---|---|
| `npm.ps1` bloqueado | Usar `npm.cmd install` y `npm.cmd run dev`. |
| `BACKEND DESCONECTADO` | Confirmar que Uvicorn esté ejecutándose en puerto 8000 y que `/api/status` responda. |
| Copernicus sin datos | Verificar `backend/.env`, credenciales, polígono, fechas y disponibilidad de píxeles sin nubes. |
| Datos ambientales incompletos | Revisar estado y cobertura de cada fuente; no todas las variables están disponibles cada día. |
| Ranking o rotaciones vacíos | Puede faltar cobertura histórica suficiente o no existir una secuencia que respete las reglas del motor. |
| El parche Git no se aplica | La versión local puede diferir de la versión base del parche; no forzar `git apply`. Revisar `git status` y los archivos con conflicto. |
| El gráfico muestra pocas observaciones | Distinguir fechas disponibles de las fechas teóricas del calendario; Sentinel-2 no garantiza un NDVI válido diario. |

### Trabajo seguro con Git

Antes de sustituir archivos o aplicar un parche, realiza un respaldo y ejecuta:

```powershell
git status --short
```

Nunca uses `git reset --hard` para solucionar un conflicto sin comprender qué cambios perderías. Comprueba también que `.env`, `.venv/` y `node_modules/` estén excluidos de Git.

## Limitaciones y próximos pasos

- **Compatibilidad no es productividad:** el ranking expresa una evaluación parcial y relativa; no sustituye validación con rendimientos reales.
- **Fenología aproximada:** las cuatro etapas proceden de duraciones referenciales, no de observaciones directas de floración o cosecha.
- **Agua disponible desconocida:** sin información confiable sobre riego, reservas de agua, drenaje y suelo, no se puede diagnosticar estrés hídrico real a partir de lluvia y ETc.
- **Distintas escalas espaciales:** NASA POWER, GPM, SMAP y Sentinel-2 no representan exactamente el mismo tamaño de área.
- **Horizonte diario fijo:** el módulo detallado muestra 2025; el motor de decisiones emplea un histórico más amplio. Son funcionalidades complementarias.
- **Validación pendiente:** pruebas locales de integración real, calibración regional, sensibilidad de ponderaciones, contraste con datos de producción y evaluación de recomendaciones de rotación.

Próximas mejoras posibles: validar el motor de compatibilidad con registros agrícolas independientes, ampliar el catálogo de cultivos, incorporar nuevas variables solo cuando tengan parámetros comparables, y evaluar posteriormente un modelo predictivo entrenado con etiquetas de rendimiento o resultados de campo.

## Referencias

- [NASA POWER — Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/)
- [NASA POWER — Fuentes meteorológicas](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/)
- [NASA POWER — Fuentes hidrológicas](https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/)
- [NASA POWER — Radiación](https://power.larc.nasa.gov/docs/methodology/data/sources_fluxes/)
- [Copernicus — Sentinel Hub Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
- [Sentinel-2 L2A — documentación de producto](https://docs.sentinel-hub.com/api/latest/data/sentinel-2-l2a/)
- [FAO — Requerimientos hídricos y etapas del cultivo](https://www.fao.org/4/s2022e/s2022e07.htm)
- [FAO-56 — Evapotranspiración del cultivo](https://www.fao.org/4/x0490e/x0490e0b.htm)
- [FAO — AquaCrop](https://www.fao.org/land-water/resources/tools/software/aquacrop/en)
- [ISRIC — SoilGrids](https://docs.isric.org/globaldata/soilgrids/)

---

### Acerca de este README único

Este documento **consolida el contenido vigente** de `README.md`, `START_HERE.md` y las guías `START_HERE_*` de las distintas fases. Está pensado para **reemplazar el README de la raíz**. Una vez verificado en tu repositorio, los documentos `START_HERE_*.md` redundantes de la raíz pueden retirarse del control de versiones; las matrices y referencias técnicas de `docs/` pueden permanecer como material complementario.
