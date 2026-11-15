import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('analysis uses only 2025 and one unchanged field map',()=>{
  const app=read('src/App.jsx');
  assert.match(app, /<FieldSelectionMap region={region} onRegionChange={setRegion}\/>/);
  assert.match(app, /<Daily2025Explorer/);
  assert.match(read('src/services/regionAnalysisService.js'),/\/api\/regions\/environment\/daily-2025/);
  assert.ok(!app.includes('type="date"'));
});
test('seven daily tabs, permanent annual window and unified crop controls',()=>{
  const c=read('src/components/historical/Daily2025Explorer.jsx');
  const stage=read('src/components/phenology/CropPhenologyPanel.jsx');
  const ids=[...c.matchAll(/\{id:'([^']+)',label:/g)].map(m=>m[1]);
  assert.deepEqual(ids,['temperature','humidity','precipitation','radiation','wind','pressure','soil_moisture']);
  assert.ok(!c.includes('fetch('));
  assert.doesNotMatch(c,/<Brush|travellerWidth/);
  assert.match(c,/<ReferenceArea/);
  assert.match(c,/timeline=\{timeline\}/);
  assert.match(stage,/type="date"/);
  assert.match(stage,/cropIndicators\(analysis,crop,sowDate\)/);
});
test('20 crop matrix and three research matrices included',()=>{
  const crops=JSON.parse(read('src/data/cropAgronomicParameters.json'));
  assert.equal(crops.crops.length,20);
  const r=JSON.parse(read('../backend/data/agricultural_indicators.json'));
  assert.ok(r.some(x=>x.id==='ET0'));
  assert.ok(r.some(x=>x.id==='NDMI'));
});
