/** Strict comparisons only where a matching crop reference and complete series exist.
 * Missing days or non-comparable parameters NEVER become a 'within range' result.
 */
const finite = x => typeof x === 'number' && Number.isFinite(x);
export function rangeStatus(observed, reference, observedDays, expectedDays) {
  if (!finite(reference?.min) || !finite(reference?.max)) return 'no_reference';
  if (!finite(observed) || !Number.isInteger(expectedDays) || expectedDays <= 0 || observedDays !== expectedDays) return 'incomplete';
  return observed < reference.min ? 'below' : observed > reference.max ? 'above' : 'within';
}
export function coldStatus(observedMinimum, reference, validDays, expectedDays) {
  if (!finite(reference?.min_c) || !finite(reference?.max_c)) return 'no_reference';
  if (!finite(observedMinimum) || !validDays) return 'incomplete';
  // An observed threshold crossing is real even if other days are missing.
  if (observedMinimum < reference.min_c) return 'below';
  if (observedMinimum <= reference.max_c) return 'within';
  return validDays === expectedDays ? 'above' : 'incomplete';
}
export function metricRow(label, value, unit, reference, status, coverage) {
  return {label,value,unit,reference,status,coverage};
}
export function buildIndicatorComparisonGroups(result, crop, hasClimate) {
  if (!result || !crop) return [];
  const groups = result.stages.map(stage => {
    const rows = stage.rows;
    const validMinima = rows.map(x=>x.temperature_min_c).filter(finite);
    const minObserved = validMinima.length ? Math.min(...validMinima) : null;
    const cRef = stage.cold_reference_c;
    const coldRange = cRef && finite(cRef.min_c) && finite(cRef.max_c)
      ? `${cRef.min_c} a ${cRef.max_c} °C · referencia de frío${stage.id === 'mid' ? ' (solo si coincide con floración)' : ''}`
      : 'Sin referencia de frío para esta fase';
    const n = metric => `${metric.valid_days}/${stage.duration_days} días`;
    const metrics = [
      metricRow('GDD acumulados',stage.totals.gdd.value,'°C·día','Sin objetivo GDD validado por etapa','no_reference',n(stage.totals.gdd)),
      metricRow('ET₀ acumulada',stage.totals.eto.value,'mm','Sin rango propio del cultivo para ET₀','no_reference',n(stage.totals.eto)),
      metricRow('ETc estimada',stage.totals.etc.value,'mm',finite(stage.kc)?`Kc ${stage.kc} · factor de cálculo, no rango de ETc`:'Sin coeficiente Kc','no_reference',n(stage.totals.etc)),
      metricRow('Precipitación acumulada',stage.totals.precipitation.value,'mm','Sin umbral de lluvia independiente del riego','no_reference',n(stage.totals.precipitation)),
      metricRow('Balance climático (P − ETc)',stage.climatic_balance.value,'mm','No equivale a estrés hídrico ni tiene rango seguro','no_reference',n(stage.climatic_balance)),
      metricRow('Humedad radicular media',stage.totals.soil_rootzone.value,'m³/m³','Sin capacidad de campo y marchitez local','no_reference',n(stage.totals.soil_rootzone)),
      metricRow('Mínima térmica observada',minObserved,'°C',coldRange,
        coldStatus(minObserved,cRef,validMinima.length,stage.duration_days),`${validMinima.length}/${stage.duration_days} días`),
    ];
    return {id:stage.id,label:stage.label,start:stage.start,end:stage.end,color:stage.color,metrics};
  });
  const entireCycle = result.estimated_cycle_days;
  groups.push({id:'cycle',label:'Ciclo completo',start:result.sow_date,end:result.estimated_maturity_date,metrics:[
    metricRow('GDD acumulados',result.total.gdd.value,'°C·día',
      crop.gdd_cycle_target_degree_days?.min != null && crop.gdd_cycle_target_degree_days?.max != null
        ?`${crop.gdd_cycle_target_degree_days.min}–${crop.gdd_cycle_target_degree_days.max} °C·día · ciclo completo`:'Sin referencia GDD por ciclo',
      rangeStatus(result.total.gdd.value,crop.gdd_cycle_target_degree_days,result.total.gdd.valid_days,entireCycle),
      `${result.total.gdd.valid_days}/${entireCycle} días`),
    metricRow('ETc estimada',result.total.etc.value,'mm',
      crop.etc_cycle_reference_mm?.min != null && crop.etc_cycle_reference_mm?.max != null
        ?`${crop.etc_cycle_reference_mm.min}–${crop.etc_cycle_reference_mm.max} mm · ciclo completo, Kc orientativo`:'Sin referencia ETc por ciclo',
      rangeStatus(result.total.etc.value,crop.etc_cycle_reference_mm,result.total.etc.valid_days,entireCycle),
      `${result.total.etc.valid_days}/${entireCycle} días`),
    metricRow('Precipitación acumulada',result.total.precipitation.value,'mm',
      'Sin rango comparable al requerimiento ETc (puede existir riego)','no_reference',`${result.total.precipitation.valid_days}/${entireCycle} días`),
  ]});
  if (!hasClimate) for(const group of groups) for(const row of group.metrics) {row.status='incomplete';}
  return groups;
}
