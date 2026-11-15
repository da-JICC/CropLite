// NASA POWER is called via CropLite's FastAPI proxy; no NASA credentials are required.
export async function getClimateTemperature(options, signal) {
  const params = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  const response = await fetch(`/api/climate/temperature?${params}`, {signal});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.detail === 'string' ? payload.detail : `Climate API error ${response.status}`);
  }
  if (payload.status !== 'model_estimate' || !Array.isArray(payload.observations)) {
    throw new Error('Unexpected NASA POWER data format');
  }
  return payload;
}
