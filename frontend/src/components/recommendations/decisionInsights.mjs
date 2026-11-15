/** User-facing interpretation of values returned by the EXISTING agronomic engine.
 * No new scoring, pseudo-probabilities, or external requests live here.
 */
export function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function meanField(rows, field) {
  const values = rows.map(row => row?.[field]).filter(numeric);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function cropInsights(crop) {
  if (!crop) return {temperature: null, development: null, rainRatio: null, highlights: []};
  const rows = Object.values(crop.scenario_results || {});
  const requiresFlooding = crop.eligible_for_rainfed_plan === false;
  const temperature = meanField(rows, 'thermal_fit_pct');
  const development = meanField(rows, 'gdd_fit_pct');
  const rainRatio = meanField(rows, 'rain_etc_ratio');
  const rainfedFit = numeric(crop.water_fit_pct) ? crop.water_fit_pct : (rainRatio !== null ? Math.min(100,rainRatio*100) : null);
  const crossingValues = rows.map(row => row?.criteria?.survival_exposure?.reference_crossing_days).filter(numeric);
  const avgCrossing = crossingValues.length ? crossingValues.reduce((a,b) => a+b, 0)/crossingValues.length : null;
  const highlights = [];
  if (requiresFlooding) highlights.push({key:'irrigation',tone:'caution',title:'Necesita riego e inundación controlada',description:'El arroz inundado no se considera elegible para los planes de secano sin confirmar disponibilidad e infraestructura hídrica.'});
  if (temperature !== null) {
    highlights.push({
      key: 'temperature',
      tone: temperature >= 70 ? 'positive' : temperature < 45 ? 'caution' : 'neutral',
      title: temperature >= 70 ? 'Temperaturas mayormente compatibles' : temperature < 45 ? 'Temperaturas poco compatibles' : 'Temperaturas compatibles solo parte del ciclo',
      description: `En las temporadas utilizadas, alrededor del ${Math.round(temperature)} % de los días del ciclo coincide con el rango climático orientativo de este cultivo.`,
    });
  }
  if (development !== null) {
    highlights.push({
      key: 'development',
      tone: development >= 98 ? 'positive' : development < 80 ? 'caution' : 'neutral',
      title: development >= 98 ? 'Calor acumulado suficiente en la evaluación' : development < 80 ? 'Podría faltar calor para completar el ciclo' : 'Calor acumulado cercano al requerido',
      description: development >= 98
        ? 'Los escenarios alcanzaron, en promedio, el mínimo de calor acumulado previsto para su desarrollo.'
        : `El calor acumulado alcanzó aproximadamente el ${Math.round(development)} % del mínimo requerido en la evaluación.`,
    });
  }
  if (avgCrossing !== null && avgCrossing > 0) {
    highlights.push({
      key: 'cold', tone: 'caution', title: 'Algunos días merecen atención',
      description: 'Se identificaron posibles exposiciones a referencias de frío o calor en fases sensibles. No equivalen a daño confirmado.',
    });
  }
  if (rainfedFit !== null) {
    highlights.push({
      key: 'water', tone: rainfedFit >= 90 ? 'positive' : rainfedFit < 60 ? 'caution' : 'neutral',
      title: rainfedFit >= 90 ? 'Lluvia potencialmente suficiente en secano' : rainfedFit < 60 ? 'Lluvias insuficientes frente a la demanda del cultivo' : 'Lluvias que podrían requerir apoyo',
      description: `El indicador hídrico estima ${Math.round(rainfedFit)} % de compatibilidad de lluvia frente a la demanda del cultivo y su etapa más exigente${crop.water_weak_stage ? ` (${crop.water_weak_stage})` : ''}. Se usa para el ranking de secano, sin afirmar agua real en las raíces ni asumir que existe riego.`,
    });
  }
  if (numeric(crop.history_sample_years)) highlights.push({key:'history',tone:'neutral',title:'Comparación de varias temporadas',description:`Se contrastaron ${crop.history_sample_years} temporadas históricas con datos suficientes para esta ventana de siembra.`});
  return {temperature, development, rainRatio, rainfedFit, avgCrossing, highlights};
}

export function rotationInsights(plan, ranked = []) {
  if (!plan?.crops || plan.crops.length < 2) return null;
  const crops = plan.crops;
  const leader = ranked[0];
  const first = crops[0];
  const gaps = Array.isArray(plan.gap_days) ? plan.gap_days : [plan.gap_days];
  const gapDescription = gaps.filter(numeric).map(n=>`${n} días`).join(' y ');
  const plannedYears = [...new Set(crops.map(c=>c.planning_year || c.sow_date?.slice(0,4)))];
  const isMultiYear = plannedYears.length > 1;
  const whyOrder = leader && leader.crop_id !== first.crop_id
    ? `${leader.crop_name} lidera la evaluación individual, pero esta secuencia comienza con ${first.crop_name}. El planificador evalúa el conjunto de ${crops.length} campañas, evita superponer ciclos, no repite especies en tres campañas y prioriza la alternancia de familias.`
    : `Esta secuencia prioriza ${crops.length} ciclos compatibles, alterna familias de cultivos consecutivos, evita repetir especies en tres campañas y conserva un tiempo de transición entre cada cosecha y nueva siembra.`;
  return {
    headline: crops.map(c=>c.crop_name).join(' → '),
    whyOrder,
    evidence: [
      {key:'calendar', label:'Plan de campañas', value: crops.map(c=>`${c.crop_name} (${c.sow_date?.slice(0,4)})`).join(' → ')},
      {key:'transition', label:'Transición entre cultivos', value:gapDescription || 'Sin información de transición'},
      {key:'families', label:'Familias que se alternan', value:crops.map(c=>c.family || 'No informada').join(' → ')},
      {key:'score', label:'Compatibilidad conjunta', value:numeric(plan.score)?`${Math.round(plan.score)}/100 (índice relativo)`:'Sin puntuación disponible'},
    ],
    reasons: plan.reasons || [],
    planningYears: plannedYears,
    isMultiYear,
  };
}
