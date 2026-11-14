// Only this layer knows about mock JSON. Replace these implementations with fetch()
// calls to the corresponding /api endpoints when the backend is ready.
import farms from '../mocks/farms.json';
import crops from '../mocks/crops.json';
import rotations from '../mocks/rotations.json';
import environment from '../mocks/environment.json';
import sources from '../mocks/sources.json';
import recommendations from '../mocks/recommendations.json';
import predictions from '../mocks/predictions.json';
import reports from '../mocks/reports.json';

const clone = (v) => JSON.parse(JSON.stringify(v));
const fetchMock = async (v) => clone(v);
export const dataService = {
  getFarms: () => fetchMock(farms),
  getFarm: (id) => fetchMock(farms.find((farm) => farm.id === id) || farms[0]),
  getEnvironmentalConditions: (id) => fetchMock(environment[id] || environment[farms[0].id]),
  getSoil: (id) => fetchMock((farms.find((farm) => farm.id === id) || farms[0])),
  getCrops: () => fetchMock(crops),
  getRotations: (id) => fetchMock(rotations[id] || rotations[farms[0].id]),
  getRotationComparisons: (id) => fetchMock(rotations[id] || rotations[farms[0].id]),
  getPredictions: (id) => fetchMock(predictions[id] || predictions[farms[0].id]),
  getRecommendations: (id) => fetchMock(recommendations[id] || recommendations[farms[0].id]),
  getReports: (id) => fetchMock(reports[id] || reports[farms[0].id]),
  getSources: () => fetchMock(sources)
};
