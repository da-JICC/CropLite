# Catálogo de etapas de cultivo · TerraAI

## Advertencia metodológica

FAO define **etapas de cobertura y coeficiente de cultivo** para la estimación hídrica. Son homogéneas entre cultivos, pero no equivalen a etapas morfológicas exactas de BBCH o Zadoks. La fase de mitad de temporada puede incluir floración: no debe leerse como una fecha precisa de floración.

## Escenario de duración seleccionado

| Cultivo | Inicial (d) | Desarrollo (d) | Media (d) | Final (d) | Total (d) | Procedencia |
|---|---:|---:|---:|---:|---:|---|
| Trigo | 15 | 25 | 50 | 30 | 120 | FAO tabla 7, caso de ciclo corto |
| Maíz grano | 20 | 35 | 40 | 30 | 125 | FAO tabla 7, caso de ciclo corto |
| Arroz inundado | 30 | 30 | 60 | 30 | 150 | JICA ANNEX 5, ejemplo de manejo regional |
| Soja | 20 | 30 | 60 | 25 | 135 | FAO tabla 7, caso de ciclo corto |
| Sorgo | 20 | 30 | 40 | 30 | 120 | FAO tabla 7, caso de ciclo corto |
| Cebada | 15 | 25 | 50 | 30 | 120 | FAO tabla 7, caso de ciclo corto |

## Requisitos almacenados por etapa

`frontend/src/data/cropPhenologyCatalog.json` contiene para cada cultivo: base y límite superior de GDD (valores de ciclo general heredados a cada fase), rango total de GDD por ciclo, referencia ETc total por ciclo, duración de fase en días, Kc por fase, referencia de frío (solo fase inicial o mitad de temporada condicionada a floración), fuente y limitaciones. Un objetivo específico de GDD por fase queda `null`: no se calculó proporcionalmente sin documentación suficiente.

### Referencias originales

- FAO: https://www.fao.org/4/s2022e/s2022e07.htm
- FAO-56: https://www.fao.org/4/x0490e/x0490e0b.htm
- JICA, ANNEX 5: https://openjicareport.jica.go.jp/pdf/12303392_01.pdf
- CSV original del usuario: `TerraAI_20_Cultivos_Indicadores_Satelitales(1).csv`

## Reglas de interpretación

- **Madurez** proyectada mediante días de calendario FAO, **no observada** por temperatura o NDVI. No se usan GDD fase por fase porque no están validados.
- **ETc** estimación bajo condiciones estándar, no agua efectivamente consumida.
- **Precipitación** representa ingreso climático, no precipitación efectiva y no incluye riego.
- **Cruces de helada** muestran potencial exposición solo en etapas con referencia de frío, no daños confirmados.
- **Cobertura 2025** toda suma indica número de días válidos. Si la siembra provoca un ciclo que termina en 2026, esos días futuros se muestran en el calendario, pero carecen de indicadores climáticos.
