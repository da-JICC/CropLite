import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rangeStatus,coldStatus,buildIndicatorComparisonGroups} from '../src/components/phenology/indicatorComparisons.mjs';
import {cropIndicators,timelineFor} from '../src/components/phenology/phenologyEngine.mjs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const catalog=JSON.parse(read('src/data/cropPhenologyCatalog.json'));
const wheat=catalog.crops.find(c=>c.id==='wheat');

test('one unified view with crop, annual chart, date control and stable phenology timeline, no map edits',()=>{
 const app=read('src/App.jsx');
 const crop=app.indexOf('<CropSelectorBar');
 const chart=app.indexOf('<Daily2025Explorer');
 const date=app.indexOf('<PlantingDateControl');
 const stages=app.indexOf('<PhenologyTimeline');
 const indicators=app.indexOf('<CropIndicatorsTable');
 assert.ok(crop>0 && crop<chart && chart<date && date<stages && stages<indicators);
 assert.equal(app.match(/<FieldSelectionMap/g)?.length,1);
 assert.match(app, /getEnvironmentalRegion\(region.geometry, controller.signal\)/);
 assert.match(app,/\}, \[region, attempt\]\);/);
 assert.doesNotMatch(app,/\[region, cropId/);
});
test('plot shows calendar stages as date-aligned backgrounds and no zoom brush',()=>{
 const explorer=read('src/components/historical/Daily2025Explorer.jsx');
 assert.match(explorer,/ReferenceArea key=\{stage.id\}/);
 assert.match(explorer,/stage.start/);
 assert.match(explorer,/stage.end/);
 assert.match(explorer,/ReferenceLine x=\{timeline\.sow_date\}/);
 assert.match(explorer,/STAGE_COLORS\[stage.id\]/);
 assert.doesNotMatch(explorer,/<Brush/);
});
test('range comparisons only use complete matching whole-cycle data',()=>{
 assert.equal(rangeStatus(100,{min:120,max:160},120,120),'below');
 assert.equal(rangeStatus(145,{min:120,max:160},120,120),'within');
 assert.equal(rangeStatus(180,{min:120,max:160},120,120),'above');
 assert.equal(rangeStatus(180,{min:120,max:160},119,120),'incomplete');
 assert.equal(rangeStatus(145,null,120,120),'no_reference');
 assert.equal(rangeStatus(null,{min:120,max:160},120,120),'incomplete');
});
test('cold reference crossing is flagged from an observed low even with other days absent',()=>{
 assert.equal(coldStatus(-11,{min_c:-10,max_c:-9},2,15),'below');
 assert.equal(coldStatus(-9.5,{min_c:-10,max_c:-9},15,15),'within');
 assert.equal(coldStatus(-5,{min_c:-10,max_c:-9},15,15),'above');
 assert.equal(coldStatus(-5,{min_c:-10,max_c:-9},2,15),'incomplete');
 assert.equal(coldStatus(null,{min_c:-10,max_c:-9},0,15),'incomplete');
});
test('stage comparisons remain unrated where stage targets absent; cold uses stage-specific reference',()=>{
 const data={datasets:{temperature:{daily:[{date:'2025-01-01',value:20,min_c:-11,max_c:25}]},eto:{daily:[{date:'2025-01-01',value:4}]},precipitation_power:{daily:[{date:'2025-01-01',value:3}]}}};
 const result=cropIndicators(data,wheat,'2025-01-01');
 const groups=buildIndicatorComparisonGroups(result,wheat,true);
 assert.equal(groups.length,5);
 assert.equal(groups[0].metrics[0].status,'no_reference'); // stage GDD has no valid reference
 assert.equal(groups[0].metrics[6].status,'below'); // observed cold crossing
 assert.equal(groups[1].metrics[6].status,'no_reference'); // no stage-specific cold reference
 assert.equal(groups[4].metrics[0].status,'incomplete'); // no full-cycle observation
 assert.equal(groups[4].metrics[1].status,'incomplete'); // no full-cycle ETc
 assert.match(groups[4].metrics[2].reference,/sin rango comparable/i);
});
test('sowing near year end retains dates in 2026 without any invented comparison',()=>{
 const t=timelineFor(wheat,'2025-12-31');
 assert.ok(t.beyond_2025);
 const result=cropIndicators({datasets:{}},wheat,'2025-12-31');
 const groups=buildIndicatorComparisonGroups(result,wheat,true);
 assert.equal(groups[4].metrics[0].status,'incomplete'); // no observed GDD
 assert.equal(groups[4].metrics[1].status,'incomplete'); // no observed ETc
 assert.equal(result.stages[1].days_in_2025,0);
});
test('full observed cycle compares GDD and ETc only with matching full-cycle references',()=>{
  const days=120, dates=Array.from({length:days},(_,i)=>{
    const d=new Date(Date.UTC(2025,0,1+i));return d.toISOString().slice(0,10);
  });
  const analysis={datasets:{
    temperature:{daily:dates.map(date=>({date,value:20,min_c:10,max_c:30}))},
    eto:{daily:dates.map(date=>({date,value:4}))},
    precipitation_power:{daily:dates.map(date=>({date,value:2}))},
    soil_moisture:{daily:dates.map(date=>({date,value:0.25,rootzone_moisture_m3_m3:0.31}))}
  }};
  const result=cropIndicators(analysis,wheat,'2025-01-01');
  const groups=buildIndicatorComparisonGroups(result,wheat,true);
  assert.equal(result.total.gdd.value,2400);
  assert.equal(groups[4].metrics[0].status,'above'); // full cycle reference max 2300
  assert.equal(groups[4].metrics[1].status,'below'); // total ETc 380 vs expected 450-650
  assert.equal(groups[4].metrics[0].coverage,'120/120 días');
  assert.equal(groups[0].metrics[0].status,'no_reference'); // never invent stage GDD target
});
