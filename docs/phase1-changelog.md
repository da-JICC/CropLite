# Reestructuración TerraAI · Fase 1

## Cambios sobre la versión anterior

- `frontend/src/App.jsx`: deja de cargar datos JSON simulados al inicio; coordina una selección GeoJSON, fechas, estado de consulta, abortado de peticiones obsoletas, y navegación a dos secciones.
- `frontend/src/components/layout/Sidebar.jsx`: solo Overview — My Farm y Environment.
- `frontend/src/components/maps/FieldSelectionMap.jsx`: único mapa activo; búsqueda manual de lugar mediante Nominatim, dibujo, edición con marcadores arrastrables, borrado y cancelación.
- `frontend/src/utils/regionGeometry.js`: área esférica pequeña, centroide/punto interior, validación simple de cruces y límites.
- `frontend/src/pages/MyFarm.jsx`: sustituye perfil demo por mapa real, fechas, parámetros y resumen de las dos fuentes.
- `frontend/src/pages/Environment.jsx`: sustituye métricas y mapas simulados por gráficos y CSV de observaciones reales, sin mapa secundario.
- `frontend/src/services/regionAnalysisService.js`: servicio único de análisis y exportación de datos con procedencia.
- `backend/region_service.py`: valida geometría GeoJSON, autointersecciones y rangos de coordenadas; calcula superficie y punto representativo.
- `backend/app.py`: añade `POST /api/regions/analyze` y mantiene endpoints existentes. Consulta ambas fuentes en paralelo con resultados parciales.
- `backend/tests/test_region_analysis.py`: comprueba geometría, flujo unificado, fallos parciales y compatibilidad con endpoints anteriores.
- `frontend/src/styles.css`: estilos responsivos de las dos páginas y del mapa principal.
- Se mueve la antigua vista HTML y guías de arranque a `docs/legacy` para evitar confundirlas con la aplicación de dos secciones.

Los componentes de NDVI, temperatura y páginas previas siguen en el repositorio para reutilización futura, pero no se montan en la navegación activa. No se eliminaron algoritmos de las APIs existentes.

## Pruebas realizadas

- 18 pruebas backend: OK.
- Parseo JS/JSX: OK.
- Geometría de ejemplo en JS: OK.
- npm/Vite completo: **NO verificado** (registro npm inaccesible en entorno de entrega).
- Consultas Copernicus y POWER a servicios remotos: **NO verificadas** (sin credenciales/red en entorno de entrega).

## Nota operativa

Al cambiar los límites del polígono o las fechas, se descartan resultados anteriores y se aborta la solicitud previa. `Environment` nunca presenta lecturas antiguas como si pertenecieran a otra región.
