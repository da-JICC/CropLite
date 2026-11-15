import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCropRecommendations,evaluatePlanting,RECOMMENDATION_METHODOLOGY} from '../src/components/recommendations/cropRecommendationEngine.mjs';
import {shiftDay} from '../src/components/phenology/phenologyEngine.mjs';
const root=new URL('../src/data/',import.meta.url);
const phenology=JSON.parse(readFileSync(new URL('cropPhenologyCatalog.json',root),'utf8'));
const thermal=JSON.parse(readFileSync(new URL('cropTemperatureCatalog.json',root),'utf8'));
const year=Array.from({length:365},(_,i)=>shiftDay('2025-01-01',i));
const series=(value,other={})=>year.map(date=>({date,value,...other}));
const climate=()=>({
 datasets:{
  temperature:{daily:series(24,{min_c:12,max_c:32})},
  eto:{daily:series(3)},
  precipitation_power:{daily:series(4)},
  vpd:{daily:series(1.2)},
  radiation:{daily:series(18)},
  soil_moisture:{daily:series(0.22,{rootzone_moisture_m3_m3:0.27})},
  ndvi:{daily:series(null)},
 }
});
test('insufficient evidence does not produce a fabricated recommendation',()=>{
 const result=buildCropRecommendations({datasets:{}},phenology.crops,thermal.crops);
 assert.equal(result.status,'insufficient');
 assert.equal(result.ranked.length,0);assert.equal(result.rotations.length,0);
});
test('ranked candidates are full 2025 calendar cycles with available measurements',()=>{
 const result=buildCropRecommendations(climate(),phenology.crops,thermal.crops);
 assert.equal(result.status,'screened');
 assert.ok(result.ranked.length>=1);
 assert.ok(result.ranked.length<=20);
 for(const item of result.ranked){
   assert.ok(item.sowDate>='2025-01-01');
   assert.ok(item.harvestDate<='2025-12-31');
   assert.ok(item.climateCoverage>=.9);
   assert.ok(item.context.vpdValidDays>0);
   assert.ok(item.context.radiationValidDays>0);
   assert.ok(item.context.soilValidDays>0);
 }
});
test('near-year-end sowing that exceeds data window cannot be scored',()=>{
 const c=phenology.crops[0],t=thermal.crops.find(crop=>crop.id===c.id);
 assert.equal(evaluatePlanting(climate(),c,t,'2025-12-20'),null);
});
test('no water information can be silently interpreted as sufficient rainfall',()=>{
 const sample=climate();sample.datasets.precipitation_power={daily:series(null)};
 const c=phenology.crops[1],t=thermal.crops.find(item=>item.id===c.id);
 const result=evaluatePlanting(sample,c,t,'2025-02-01');
 assert.ok(result);assert.equal(result.waterComplete,false);assert.equal(result.rainEtcRatio,null);
 assert.match(result.vulnerabilities.join(' '),/Insufficient coverage/);
});
test('missing temperature invalidates ranking even if other series exist',()=>{
 const sample=climate();sample.datasets.temperature.daily=sample.datasets.temperature.daily.map((row,i)=>i<20?row:{...row,value:null});
 const result=buildCropRecommendations(sample,phenology.crops,thermal.crops);
 assert.equal(result.status,'insufficient');
});
test('rotations only follow a family change, without overlap, with transition time',()=>{
 const result=buildCropRecommendations(climate(),phenology.crops,thermal.crops);
 for(const plan of result.rotations){
  assert.equal(plan.crops.length,2);
  assert.notEqual(plan.crops[0].family,plan.crops[1].family);
  assert.ok(plan.crops[0].harvestDate < plan.crops[1].sowDate);
  assert.ok(plan.gapDays>=RECOMMENDATION_METHODOLOGY.transition_buffer_days);
  assert.ok(plan.crops[1].harvestDate<='2025-12-31');
 }
});
test('does not alter map implementation or require remote data to recompute',()=>{
 assert.equal(RECOMMENDATION_METHODOLOGY.type,'interpretable_rules_not_trained_ml');
 const a=buildCropRecommendations(climate(),phenology.crops,thermal.crops);
 const b=buildCropRecommendations(climate(),phenology.crops,thermal.crops);
 assert.deepEqual(a,b);
});
