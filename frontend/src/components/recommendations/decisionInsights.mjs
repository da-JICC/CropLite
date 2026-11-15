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
  const temperature = meanField(rows, 'thermal_fit_pct');
  const development = meanField(rows, 'gdd_fit_pct');
  const rainRatio = meanField(rows, 'rain_etc_ratio');
  const crossingValues = rows.map(row => row?.criteria?.survival_exposure?.reference_crossing_days).filter(numeric);
  const avgCrossing = crossingValues.length ? crossingValues.reduce((a,b) => a+b, 0)/crossingValues.length : null;
  const highlights = [];
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
  if (rainRatio !== null) {
    highlights.push({
      key: 'water', tone: rainRatio >= 1 ? 'neutral' : 'caution',
      title: rainRatio >= 1 ? 'Lluvia comparable a la demanda estimada' : 'La lluvia podría no cubrir la demanda de agua',
      description: rainRatio >= 1
        ? 'La lluvia acumulada fue similar o superior a la demanda teórica de agua durante los ciclos evaluados. No se verifica cuánto quedó disponible para las raíces.'
        : 'La lluvia acumulada fue menor que la demanda teórica de agua durante los ciclos evaluados. Se desconoce el aporte de riego y las reservas del suelo.',
    });
  }
  return {temperature, development, rainRatio, avgCrossing, highlights};
}

export function rotationInsights(plan, ranked = []) {
  if (!plan?.crops || plan.crops.length < 2) return null;
  const [first, second] = plan.crops;
  const leader = ranked[0];
  const gap = plan.gap_days;
  const score = plan.score;
  const whyOrder = leader && leader.crop_id !== first.crop_id
    ? `${leader.crop_name} lidera la evaluación individual, pero este plan comienza con ${first.crop_name}: aquí se priorizan dos ciclos que encajen en el calendario y su puntuación conjunta.`
    : `El orden ${first.crop_name} → ${second.crop_name} responde a la compatibilidad del calendario y la evaluación conjunta de ambos cultivos.`;
  return {
    headline: `${first.crop_name} primero, ${second.crop_name} después`,
    whyOrder,
    evidence: [
      {key:'calendar', label:'Primer cultivo', value:`${first.crop_name}: ${first.sow_date} a ${first.harvest_date}`},
      {key:'transition', label:'Tiempo entre cultivos', value:numeric(gap) ? `${gap} días para la transición` : 'Sin dato de transición'},
      {key:'families', label:'Familias distintas', value:`${first.family || 'No informada'} → ${second.family || 'No informada'}`},
      {key:'score', label:'Evaluación conjunta', value:numeric(score)?`${Math.round(score)}/100 (índice relativo)`:'Sin puntuación disponible'},
    ],
  };
}
