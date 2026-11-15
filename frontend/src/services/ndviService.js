// Satellite-data access lives behind a small local API; NEVER store API secrets here.
import ndviDemo from '../mocks/ndvi.json';

export function getDemoNdvi(farmId, start, end) {
  const obs = ndviDemo[farmId] || ndviDemo.casablanca;
  return {
    source: 'CropLite synthetic illustration', status: 'simulated', index: 'NDVI',
    resolution_m: null, interval: 'P1M', start, end,
    observations: obs.filter(o => o.date >= start && o.date <= end),
  };
}

export async function getNdviStatus(signal) {
  const response = await fetch('/api/status', {signal});
  if (!response.ok) throw new Error('CropLite backend status unavailable');
  return response.json();
}

export async function getLiveNdvi({polygon, start, end, interval = 'P10D'}, signal) {
  const response = await fetch('/api/ndvi', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({polygon, start, end, interval}), signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    typeof result.detail === 'string' ? result.detail : `API error ${response.status}`
  );
  return result;
}
