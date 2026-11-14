export const priorities = [
  { id: 'balanced', label: 'Balanced priorities' },
  { id: 'water', label: 'Conserve water' },
  { id: 'soil', label: 'Improve soil health' },
  { id: 'climate', label: 'Climate resilience' },
  { id: 'market', label: 'Market suitability' }
];

const dimensions = {
  soil: { soil: 0.38, nutrients: 0.26, erosion: 0.22, drought: 0.14 },
  water: { water: 0.58, drought: 0.24, soil: 0.18 },
  climate: { drought: 0.46, erosion: 0.20, water: 0.23, soil: 0.11 },
  market: { market: 0.62, implementation: 0.22, water: 0.16 },
  balanced: { soil: 0.2, water: 0.2, drought: 0.2, market: 0.2, implementation: 0.2 }
};

export function metricValue(strategy, key) {
  return key === 'water' ? 100 - strategy.water : strategy[key];
}

export function weightedScore(strategy, priority = 'balanced') {
  const weights = dimensions[priority] || dimensions.balanced;
  return Math.round(Object.entries(weights).reduce((total, [key, weight]) => total + metricValue(strategy, key) * weight, 0));
}

export const criteria = [
  { key: 'soil', label: 'Soil health potential', higher: true },
  { key: 'water', label: 'Water demand', higher: false },
  { key: 'nutrients', label: 'Nutrient cycling', higher: true },
  { key: 'erosion', label: 'Erosion reduction', higher: true },
  { key: 'drought', label: 'Drought resilience', higher: true },
  { key: 'market', label: 'Market suitability', higher: true },
  { key: 'forage', label: 'Forage potential', higher: true },
  { key: 'implementation', label: 'Ease of adoption', higher: true }
];

export const strategyPalette = { A: '#647c8a', B: '#2f8961', C: '#3288b6' };
