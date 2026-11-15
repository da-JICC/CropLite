import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url),'utf8');

test('one page without sidebar, navigation or manual dates', () => {
  const app=read('src/App.jsx');
  assert.ok(app.includes('<FieldSelectionMap region={region} onRegionChange={setRegion}/>'));
  assert.ok(app.includes('<Daily2025Explorer'));
  assert.ok(!app.includes('<Sidebar'));
  assert.ok(!app.includes('type="date"'));
  assert.ok(!app.includes('onDateChange'));
  assert.ok(!app.includes('<MyFarm'));
  assert.ok(!app.includes('<Environment '));
});

test('crop and environmental tabs are local and cannot trigger external requests', () => {
  const app=read('src/App.jsx');
  const tabs=read('src/components/historical/EnvironmentalExplorer.jsx');
  assert.ok(app.includes('}, [region, attempt]);'));
  assert.ok(!app.includes('}, [region, cropId'));
  assert.ok(tabs.includes("useState('temperature')"));
  assert.ok(tabs.includes('onClick={()=>onCropSelect(c.id)}'));
  assert.ok(tabs.includes('setView('));
  assert.ok(!tabs.includes('fetch('));
});

test('original map file is used as-is without adding a second map', () => {
  const map=read('src/components/maps/FieldSelectionMap.jsx');
  const app=read('src/App.jsx');
  const tabs=read('src/components/historical/EnvironmentalExplorer.jsx');
  assert.ok(map.includes('<MapContainer'));
  assert.ok(app.includes('FieldSelectionMap'));
  assert.ok(!tabs.includes('MapContainer'));
});
