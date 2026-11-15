import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('unchanged map remains sole field-selection entrypoint and only region triggers network effect',()=>{
 const app=read('src/App.jsx');
 assert.match(app, /<FieldSelectionMap region=\{region\} onRegionChange=\{setRegion\}\/\>/);
 assert.match(app,/\}, \[region, attempt\]\);/);
 assert.match(app, /<CropSelectorBar/);
 assert.match(app, /<PlantingDateControl/);
 assert.match(app, /<PhenologyTimeline/);
 assert.match(app, /<CropIndicatorsTable/);
 assert.match(app, /<Daily2025Explorer/);
 assert.doesNotMatch(app,/\}, \[region, cropId/);
 assert.match(app,/getEnvironmentalRegion\(region.geometry, controller.signal\)/);
});
test('environment has only seven tabs; phenology is outside the tab component',()=>{
 const explorer=read('src/components/historical/Daily2025Explorer.jsx');
 const ids=[...explorer.matchAll(/\{id:'([^']+)',label:/g)].map(m=>m[1]);
 assert.deepEqual(ids,['temperature','humidity','precipitation','radiation','wind','pressure','soil_moisture']);
 assert.doesNotMatch(explorer,/CropPhenologyPanel|cropSeries|fetch\(/);
 assert.doesNotMatch(explorer,/<Brush/);
 assert.match(explorer, /<ReferenceArea/);
 assert.match(explorer, /<ReferenceLine/);
});
test('sowing date date picker and draggable range never affect upstream API requests',()=>{
 const ui=read('src/components/phenology/CropPhenologyPanel.jsx');
 assert.match(ui,/type="date" min="2025-01-01" max="2025-12-31"/);
 assert.match(ui,/type="range"/);
 assert.match(ui,/STAGE_COLORS\[stage.id\]/);
 assert.match(ui,/data\w*\b|analysis/);
 assert.doesNotMatch(ui,/fetch\(/);
});
