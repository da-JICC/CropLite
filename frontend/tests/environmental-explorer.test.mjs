import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('one original map and no six-year UI navigation',()=>{
  const app=read('src/App.jsx');
  assert.ok(app.includes('<FieldSelectionMap region={region} onRegionChange={setRegion}/>'));
  assert.ok(app.includes('<Daily2025Explorer'));
  assert.ok(!app.includes('<HistoricalTabs'));
  assert.ok(!app.includes('seis años'));
  assert.ok(!app.includes('type="date"'));
});
test('one active chart with seven parameter tabs and shared region fetch',()=>{
  const component=read('src/components/historical/EnvironmentalExplorer.jsx');
  const app=read('src/App.jsx');
  for(const p of ['temperature','humidity','precipitation','radiation','wind','soil_moisture','ndvi'])
    assert.ok(component.includes(`id:'${p}'`) || component.includes(`id: '${p}'`),p);
  assert.ok(component.includes('tab===s.id'));
  assert.ok(component.includes('onClick={()=>onCropSelect(c.id)}'));
  assert.ok(!component.includes('fetch('));
  assert.ok(app.includes('}, [region, attempt]);'));
  assert.ok(app.includes('getEnvironmentalRegion(region.geometry, controller.signal)'));
});
test('data service points to environmental API and does not require date fields',()=>{
  const source=read('src/services/regionAnalysisService.js');
  assert.ok(source.includes("fetch('/api/regions/environment/daily-2025'"));
  assert.ok(source.includes('JSON.stringify({polygon})'));
});
