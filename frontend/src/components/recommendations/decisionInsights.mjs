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
  if (requiresFlooding) highlights.push({key:'irrigation',tone:'caution',title:'Requires irrigation and controlled flooding',description:'Flooded rice is not eligible for rainfed plans without confirming water supply and irrigation infrastructure.'});
  if (temperature !== null) {
    highlights.push({
      key: 'temperature',
      tone: temperature >= 70 ? 'positive' : temperature < 45 ? 'caution' : 'neutral',
      title: temperature >= 70 ? 'Mostly suitable temperatures' : temperature < 45 ? 'Low temperature suitability' : 'Temperatures suitable for part of the cycle',
      description: `Across the seasons evaluated, about ${Math.round(temperature)} % of crop-cycle days fall within this crop’s indicative climatic range.`,
    });
  }
  if (development !== null) {
    highlights.push({
      key: 'development',
      tone: development >= 98 ? 'positive' : development < 80 ? 'caution' : 'neutral',
      title: development >= 98 ? 'Enough accumulated heat in the assessment' : development < 80 ? 'Accumulated heat may be insufficient for a complete cycle' : 'Accumulated heat near the estimated requirement',
      description: development >= 98
        ? 'The scenarios reached the minimum expected accumulated heat requirement on average.'
        : `Accumulated heat reached approximately ${Math.round(development)} % of the minimum required in this assessment.`,
    });
  }
  if (avgCrossing !== null && avgCrossing > 0) {
    highlights.push({
      key: 'cold', tone: 'caution', title: 'Potential thermal exposure',
      description: 'Possible cold or heat threshold crossings were identified during sensitive stages. These do not confirm crop damage.',
    });
  }
  if (rainfedFit !== null) {
    highlights.push({
      key: 'water', tone: rainfedFit >= 90 ? 'positive' : rainfedFit < 60 ? 'caution' : 'neutral',
      title: rainfedFit >= 90 ? 'Rainfall may be sufficient under rainfed conditions' : rainfedFit < 60 ? 'Rainfall below estimated crop demand' : 'Supplementary irrigation may be needed',
      description: `The water indicator estimates ${Math.round(rainfedFit)} % rainfall suitability relative to crop demand, including the most demanding stage${crop.water_weak_stage ? ` (${crop.water_weak_stage})` : ''}. This informs the rainfed ranking; it does not establish actual root-zone water availability or assume irrigation.`,
    });
  }
  if (numeric(crop.history_sample_years)) highlights.push({key:'history',tone:'neutral',title:'Comparison across multiple seasons',description:`The analysis compared ${crop.history_sample_years} historical seasons with sufficient data for this planting window.`});
  return {temperature, development, rainRatio, rainfedFit, avgCrossing, highlights};
}

export function rotationInsights(plan, ranked = []) {
  if (!plan?.crops || plan.crops.length < 2) return null;
  const crops = plan.crops;
  const leader = ranked[0];
  const first = crops[0];
  const gaps = Array.isArray(plan.gap_days) ? plan.gap_days : [plan.gap_days];
  const gapDescription = gaps.filter(numeric).map(n=>`${n} days`).join(' and ');
  const plannedYears = [...new Set(crops.map(c=>c.planning_year || c.sow_date?.slice(0,4)))];
  const isMultiYear = plannedYears.length > 1;
  const whyOrder = leader && leader.crop_id !== first.crop_id
    ? `${leader.crop_name} leads the individual ranking, but this rotation begins with ${first.crop_name}. The planner evaluates the full ${crops.length} crop sequence, prevents overlapping cycles, avoids repeating the same crop in one year and prioritizes alternating botanical families.`
    : `This sequence prioritizes ${crops.length} compatible cycles within the year, alternates botanical families, avoids repeating crops and allows a transition between harvest and the next planting.`;
  return {
    headline: crops.map(c=>c.crop_name).join(' → '),
    whyOrder,
    evidence: [
      {key:'calendar', label:'Crop sequence', value: crops.map(c=>`${c.crop_name} (${c.sow_date?.slice(0,4)})`).join(' → ')},
      {key:'transition', label:'Transition between crops', value:gapDescription || 'Transition unavailable'},
      {key:'families', label:'Alternating families', value:crops.map(c=>c.family || 'Not specified').join(' → ')},
      {key:'score', label:'Combined suitability', value:numeric(plan.score)?`${Math.round(plan.score)}/100 (relative index)`:'Score unavailable'},
    ],
    reasons: plan.reasons || [],
    planningYears: plannedYears,
    isMultiYear,
  };
}
