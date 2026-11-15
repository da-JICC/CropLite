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
      ? `${cRef.min_c} to ${cRef.max_c} °C · cold reference${stage.id === 'mid' ? ' (only if flowering actually occurs)' : ''}`
      : 'No cold reference for this stage';
    const n = metric => `${metric.valid_days}/${stage.duration_days} days`;
    const metrics = [
      metricRow('Accumulated GDD',stage.totals.gdd.value,'°C·day','No validated stage-specific GDD target','no_reference',n(stage.totals.gdd)),
      metricRow('Accumulated ET₀',stage.totals.eto.value,'mm','No crop-specific ET₀ range','no_reference',n(stage.totals.eto)),
      metricRow('Estimated ETc',stage.totals.etc.value,'mm',finite(stage.kc)?`Kc ${stage.kc} · calculation factor, not an ETc reference range`:'No Kc coefficient','no_reference',n(stage.totals.etc)),
      metricRow('Accumulated precipitation',stage.totals.precipitation.value,'mm','No rainfall threshold independent of irrigation','no_reference',n(stage.totals.precipitation)),
      metricRow('Climatic balance (P − ETc)',stage.climatic_balance.value,'mm','Not a direct water-stress measurement; no validated safe range','no_reference',n(stage.climatic_balance)),
      metricRow('Mean root-zone moisture',stage.totals.soil_rootzone.value,'m³/m³','Local field capacity and wilting point unavailable','no_reference',n(stage.totals.soil_rootzone)),
      metricRow('Observed minimum temperature',minObserved,'°C',coldRange,
        coldStatus(minObserved,cRef,validMinima.length,stage.duration_days),`${validMinima.length}/${stage.duration_days} days`),
    ];
    return {id:stage.id,label:stage.label,start:stage.start,end:stage.end,color:stage.color,metrics};
  });
  const entireCycle = result.estimated_cycle_days;
  groups.push({id:'cycle',label:'Full cycle',start:result.sow_date,end:result.estimated_maturity_date,metrics:[
    metricRow('Accumulated GDD',result.total.gdd.value,'°C·day',
      crop.gdd_cycle_target_degree_days?.min != null && crop.gdd_cycle_target_degree_days?.max != null
        ?`${crop.gdd_cycle_target_degree_days.min}–${crop.gdd_cycle_target_degree_days.max} °C·day · full cycle`:'No full-cycle GDD reference',
      rangeStatus(result.total.gdd.value,crop.gdd_cycle_target_degree_days,result.total.gdd.valid_days,entireCycle),
      `${result.total.gdd.valid_days}/${entireCycle} days`),
    metricRow('Estimated ETc',result.total.etc.value,'mm',
      crop.etc_cycle_reference_mm?.min != null && crop.etc_cycle_reference_mm?.max != null
        ?`${crop.etc_cycle_reference_mm.min}–${crop.etc_cycle_reference_mm.max} mm · full cycle, indicative Kc`:'No full-cycle ETc reference',
      rangeStatus(result.total.etc.value,crop.etc_cycle_reference_mm,result.total.etc.valid_days,entireCycle),
      `${result.total.etc.valid_days}/${entireCycle} days`),
    metricRow('Accumulated precipitation',result.total.precipitation.value,'mm',
      'No comparable rainfall range for ETc demand (irrigation may be available)','no_reference',`${result.total.precipitation.valid_days}/${entireCycle} days`),
  ]});
  if (!hasClimate) for(const group of groups) for(const row of group.metrics) {row.status='incomplete';}
  return groups;
}
