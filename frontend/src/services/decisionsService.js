/** Long-term historical decision engine; separate from daily-2025 visualizations. */
async function postRegion(path, polygon, signal) {
  const response = await fetch(path, {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({polygon}), signal});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof payload?.detail==='string'?payload.detail:`HTTP ${response.status}`);
  return payload;
}
export function loadDecisionHistory(polygon,signal) {
  return postRegion('/api/regions/decisions/history',polygon,signal);
}
export function loadDecisionNDVI(polygon,signal) {
  return postRegion('/api/regions/decisions/ndvi-history',polygon,signal);
}
