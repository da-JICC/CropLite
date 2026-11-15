import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../src/',import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),'utf8');

test('historic decisions are placed under original map, not replacing daily 2025 explorer',()=>{
 const app=read('App.jsx');
 assert.match(app,/<FieldSelectionMap region=\{region\} onRegionChange=\{setRegion\}\/>/);
 assert.match(app,/<AgriculturalDecisions region=\{region\} cropId=\{cropId\} onCropSelect=\{setCropId\}/);
 assert.ok(app.indexOf('<FieldSelectionMap')<app.indexOf('<AgriculturalDecisions'));
 assert.ok(app.indexOf('<AgriculturalDecisions')<app.indexOf('<Daily2025Explorer'));
});
test('historic API calls depend on polygon, never on crop or scenario state',()=>{
 const component=read('components/recommendations/AgriculturalDecisions.jsx');
 const service=read('services/decisionsService.js');
 assert.match(service,/\/api\/regions\/decisions\/history/);
 assert.match(service,/\/api\/regions\/decisions\/ndvi-history/);
 assert.match(component,/\},\[key,attempt\]\)/);
 assert.doesNotMatch(component,/setScenario/);
 assert.doesNotMatch(component,/terra-decision-scenarios/);
 assert.doesNotMatch(component,/<SeasonalMiniChart/);
 assert.doesNotMatch(component,/\[key,cropId\]/);
});
test('historical NDVI is identified as independent retrospective context',()=>{
 const component=read('components/recommendations/AgriculturalDecisions.jsx');
 assert.match(component,/nunca como etiqueta del cultivo futuro/);
 assert.match(component,/Evaluación basada en reglas/);
 assert.match(component,/No predice el rendimiento/i);
});
test('ten crop catalog and 4 phases with no invented stage-level GDD',()=>{
 const crop=JSON.parse(read('data/cropPhenologyCatalog.json'));
 assert.equal(crop.crops.length,10);
 assert.ok(crop.crops.every(c=>c.stages.length===4 && c.stages.every(stage=>stage.gdd_stage_target_degree_days === null)));
 assert.ok(crop.crops.some(c=>c.id==='papa')); 
});
