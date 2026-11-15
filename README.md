# TerraAI · Fase 1 — Mapa único + NDVI + temperatura

**Proyecto existente reestructurado, NO reconstruido desde cero.**

La aplicación activa contiene únicamente:

- **Overview — My Farm:** un solo mapa Leaflet para buscar, dibujar, editar y eliminar la región de cultivo. Selección de fechas y botón **Analizar región**.
- **Environment:** gráficos y estadísticas reales de **NDVI (Copernicus Sentinel-2 L2A)** y **temperatura media/mínima/máxima (NASA POWER)** para la región seleccionada.

El resto de los módulos React anteriores se conserva en `frontend/src/pages/` para futuras etapas, **pero ya no se importa ni se muestra en navegación**. El antiguo HTML con nueve secciones está archivado bajo `docs/legacy/` y **NO corresponde a esta versión**. No lo abras esperando ver el nuevo mapa.

## Flujo de trabajo

1. Abrir **Overview — My Farm**.
2. Buscar una ciudad o localidad, o mover el mapa directamente. La búsqueda utiliza el servicio público de OpenStreetMap/Nominatim; si falla, el dibujo manual sigue funcionando.
3. Seleccionar **Dibujar campo** y hacer clic en los vértices del terreno. Se requieren 3–40 vértices y un campo de hasta aprox. 10 km de extensión.
4. Seleccionar **Confirmar polígono**. Si hace falta ajustar la geometría, seleccionar **Editar** y arrastrar los vértices verdes.
5. Elegir fechas (máximo un año), intervalos NDVI y, opcionalmente, umbrales térmicos.
6. Seleccionar **Analizar región**. El backend consulta en paralelo ambas fuentes y permite resultados parciales si una falla.
7. Entrar en **Environment** para examinar los gráficos y exportar cada conjunto de datos a CSV.
8. Volver a My Farm para elegir otro campo. Cambiar polígono, fechas o umbrales invalida los resultados anteriores (no se mezcla información de regiones distintas).

**No hay datos ambientales simulados en las pantallas activas.** Si falta el backend o las credenciales Copernicus, la interfaz muestra el fallo de esa fuente sin presentar ejemplos inventados.

## Instalación en Windows + VS Code

> Este ZIP contiene el **código**, no las carpetas generadas `node_modules`, `.venv` ni los secretos de tu `backend/.env`. Si ya tienes credenciales Copernicus en el proyecto anterior, consérvalas localmente.

### 1. Abrir el proyecto

Extraer el ZIP. Abrir en VS Code la carpeta `terra-ai` (contiene `frontend`, `backend`).

### 2. Backend (Terminal 1)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Crear `backend/.env` **en tu equipo** usando `backend/.env.example` como referencia. Ejemplo de nombres (sin compartir valores):

```text
CDSE_CLIENT_ID=tu_cliente
CDSE_CLIENT_SECRET=tu_secreto
```

Si usas el **patch** en tu repositorio original y `.venv` ya existe en `backend`, puedes conservarlo; igualmente instala los requisitos si cambiaron.

Arrancar el servidor:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --reload --port 8000
```

Visita `http://127.0.0.1:8000/api/status` para comprobar que funciona. `copernicus_configured` indica solo si las credenciales existen, **no garantiza** una petición satelital exitosa.

### 3. Frontend (Terminal 2)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abrir la URL que muestra Vite (normalmente `http://localhost:5173/`). Usamos `npm.cmd` para evitar el bloqueo de `npm.ps1` por la política de PowerShell.

**Importante:** ejecutar `npm.cmd install` desde la carpeta `frontend`, no desde la raíz del proyecto.

### 4. Prueba sin sorpresas

1. En el mapa de Overview busca **Casablanca, Chile**, dibuja un polígono pequeño y confírmalo.
2. Selecciona, por ejemplo, del **2026-01-01** al **2026-02-01**.
3. Presiona **Analizar región** y consulta los resultados en Environment.
4. Si Copernicus no está configurado, espera un error solo en el panel de NDVI; la consulta a NASA POWER debe poder continuar (si hay internet).

## Estructura principal

```text
terra-ai/
  backend/
    app.py                       # /api/ndvi + NASA endpoints anteriores + /api/regions/analyze
    region_service.py            # Valida polígono, calcula área y punto representativo
    copernicus.py                # Sentinel Hub Statistical API existente
    nasa_power_service.py        # NASA POWER Daily API existente
    agroclimate.py               # Métricas térmicas existentes para futuro
    tests/
  frontend/
    src/
      App.jsx                    # Estado geográfico y análisis compartidos
      components/maps/FieldSelectionMap.jsx   # ÚNICO mapa activo
      pages/MyFarm.jsx           # Overview — My Farm
      pages/Environment.jsx      # Gráficos; SIN mapa
      services/regionAnalysisService.js       # Solicitud unificada y CSV
      utils/regionGeometry.js    # Validación preliminar y superficie en cliente
      components/layout/Sidebar.jsx          # SOLO 2 secciones
      pages/                     # Otras páginas antiguas conservadas, inactivas
  docs/legacy/                   # Guías y vista previa antigua; NO usar para la fase 1
```

## Contrato del endpoint principal

```http
POST /api/regions/analyze
Content-Type: application/json
```

```json
{
  "polygon": {
    "type": "Polygon",
    "coordinates": [[[-71.415,-33.322],[-71.410,-33.322],[-71.410,-33.319],[-71.415,-33.319],[-71.415,-33.322]]]
  },
  "start": "2026-01-01",
  "end": "2026-02-01",
  "interval": "P10D",
  "heat_threshold": 35,
  "cold_threshold": 0
}
```

Respuesta: `region` (geometría, hectáreas, punto representativo), `period`, `status` (`success`, `partial`, `error`), y `datasets.ndvi` / `datasets.temperature` (cada uno tiene `status`, `sampling_method`, `data` o `error`).

Los endpoints originales `/api/ndvi`, `/api/climate/temperature`, `/api/climate/gdd`, `/api/climate/temperature-summary` y `/api/status` se conservan para compatibilidad con la versión anterior.

## Diferencias entre las dos fuentes

| Fuente | Qué observa | Cómo se consulta |
|---|---|---|
| Copernicus Sentinel-2 L2A | Índice espectral NDVI de la vegetación; intervalos con observaciones nulas si no hay píxeles válidos | Estadísticas sobre **todo el polígono** usando Sentinel Hub Statistical API |
| NASA POWER | Estimaciones de temperatura del aire a 2 m (T2M, T2M_MAX, T2M_MIN) | **Punto representativo** del polígono; NO promedio espacial de campo |

Las dos fuentes no tienen la misma resolución, frecuencia ni método de muestreo. **NDVI no es un rendimiento agrícola**, y la temperatura NASA POWER **no es una lectura in situ**.

## Pruebas y limitaciones

- `cd backend && pytest -q tests` — **18 pruebas automatizadas pasaron** en el entorno de desarrollo, incluyendo casos de geometría válida/inválida, ambas fuentes simuladas *solo dentro de los tests* y resultado parcial si falla Copernicus.
- Comprobación sintáctica de archivos JSX/JS con el parser TypeScript — **correcta**.
- Comprobación directa del cálculo de geometría JavaScript — **correcta** para polígono de muestra.
- **No se pudo ejecutar `npm install` ni `vite build` aquí:** faltan paquetes npm en la caché y el registro no respondió. El frontend requiere una compilación real en un equipo con conectividad.
- **No se realizaron solicitudes en vivo a las APIs externas** desde este entorno; las credenciales reales permanecen en tu equipo.
- La búsqueda Nominatim depende de un servicio de terceros y puede fallar; siempre es posible navegar manualmente en el mapa.
- El área calculada utiliza una aproximación esférica válida para campos pequeños; **no es un deslinde catastral**.
- Esta fase no incluye mapas de temperatura por píxel, humedad de suelo, precipitación, GDD visible ni modelos predictivos.

## Seguridad y siguientes fases

No compartas `backend/.env` ni lo subas a GitHub. El frontend nunca recibe claves OAuth; estas viven en FastAPI. Futuras integraciones (SMAP, GPM, MODIS, ECOSTRESS, modelos predictivos) deberán reutilizar el polígono GeoJSON y ampliar los servicios, **sin crear más mapas principales**.
