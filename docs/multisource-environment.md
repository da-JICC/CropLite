# Actualización multifuente — Decisiones técnicas

## 1. Datos reales frente a estimaciones

No llamar a NASA POWER un termómetro satelital. Sus campos meteorológicos son estimaciones de reanálisis/representaciones regionales. Sentinel-2 NDVI es un índice derivado de imágenes de reflectancia dentro del polígono. GPM IMERG estima precipitación mediante una constelación de sensores y productos auxiliares; el producto SMAP L4 es modelado/asimilación. Ninguno equivale a un sensor de suelo dentro del campo.

## 2. Rango temporal automático y presentación

Se solicita cada producto desde su fecha de inicio conservadora hasta el último año completo. No se trunca a seis años ni se exige que la historia NDVI comience en 1981. Las pestañas muestran uno de los siguientes:

- **Ciclo estacional:** 12 meses, promedios históricos y percentiles 10/90 entre años con datos válidos, por variable. Para precipitaciones, promedios de **totales mensuales**, no de mm/día.
- **Serie mensual:** todos los meses disponibles, con `null` para datos faltantes, sin interpolación automática. Para temperatura, las curvas mínima/máxima son **medias mensuales de mínimos/máximos diarios**, no extremos absolutos del mes.

En la visualización de temperatura, las bandas/umbrales agronómicos no cambian los datos históricos. Sin la fecha de siembra ni la etapa fenológica no corresponde inferir daño específico.

## 3. Observaciones prácticas

- NASA POWER puede ser lento al recuperar décadas de datos: se solicitan bloques multianuales y se reutilizan resultados desde una caché en memoria. La primera carga de un terreno puede requerir varios bloques; no repetir mientras se cambia de pestaña o cultivo.
- Precipitación IMERG usa días UTC y los meteorológicos principales POWER usan tiempo solar local, por lo que no se deben comparar como si fueran observaciones diarias perfectamente simultáneas. La vista mensual reduce ese problema, aunque no lo elimina.
- Los productos SMAP por POWER HY necesitan confirmación en vivo de la modalidad de resolución/alias y deben llevar identificación de origen de producto en producción. Si no se confirma, la gráfica se debe considerar estimación de POWER HY y no medición SMAP L4 certificada.
- La disponibilidad temporal de radiación solar puede ser diferente de la meteorológica, por eso su consulta es independiente.
- Se conservan rutas antiguas para compatibilidad, pero la UI usa `/api/regions/environment`.
- SoilGrids REST estaba temporalmente suspendida al desarrollar esta actualización; pH y N cartografiados son predicciones de suelos y no sustituyen laboratorio. No hay base para introducir P y K de manera automática como mediciones verificadas.

## 4. Verificaciones antes de considerar el sistema operativo

1. Instalar dependencias y ejecutar Vite en Windows.
2. Confirmar que NASA POWER acepta las variables AG de 1981–último año completo y radiación desde 1984; registrar cualquier error de cobertura.
3. Confirmar que `IMERG_PRECTOT` funciona en HY y su unidad diaria; si falla, registrar el respaldo de precipitación corregida POWER.
4. Comprobar la procedencia de `SFMC/RZMC` en NASA POWER y que se usa el producto de alta resolución SMAP L4, no MERRA-2 por sustitución implícita.
5. Probar consultas Copernicus con OAuth y polígonos de tamaño acotado, revisar cuotas/costos y estadísticas NDVI.
6. Probar las siete pestañas con valores faltantes y fallos parciales. Confirmar que los cambios de cultivo/tab no envían nuevas consultas.
7. Validar las estimaciones contra observaciones independientes antes de desarrollar cualquier recomendación o proyección agrícola.
