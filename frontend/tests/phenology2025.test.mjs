import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {timelineFor,cropIndicators,dayIndex} from '../src/components/phenology/phenologyEngine.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/cropPhenologyCatalog.json',import.meta.url),'utf8'));
const crop=id=>catalog.crops.find(c=>c.id===id);
const fake=()=>({datasets:{temperature:{daily:[{date:'2025-01-01',value:20,min_c:-12,max_c:30},{date:'2025-01-02',value:22,min_c:10,max_c:31}]},eto:{daily:[{date:'2025-01-01',value:4},{date:'2025-01-02',value:5}]},precipitation_power:{daily:[{date:'2025-01-01',value:2},{date:'2025-01-02',value:8}]},soil_moisture:{daily:[{date:'2025-01-01',value:0.28,rootzone_moisture_m3_m3:0.3}]}}});
test('all ten crops four stages and documented durations',()=>{
 assert.equal(catalog.crops.length,10);
 for(const c of catalog.crops){
  assert.deepEqual(c.stages.map(x=>x.id),['initial','development','mid','late']);
  assert.equal(c.stages.reduce((n,x)=>n+x.duration_days,0),c.cycle_days);
  for(const s of c.stages){assert.equal(s.gdd_base_c,c.gdd_base_c);assert.equal(s.gdd_stage_target_degree_days,null);}
 }
 assert.equal(crop('rice').stages[1].kc,1.1);
});
test('wheat full timeline and UTC boundaries',()=>{
 const t=timelineFor(crop('wheat'),'2025-01-01');
 assert.equal(t.estimated_maturity_date,'2025-04-30');
 assert.deepEqual(t.stages.map(x=>[x.start,x.end]),[
  ['2025-01-01','2025-01-15'],['2025-01-16','2025-02-09'],['2025-02-10','2025-03-31'],['2025-04-01','2025-04-30']]);
 assert.equal(t.beyond_2025,false);
});
test('only 2025 sowing allowed; Dec 31 never fills 2026 with synthetic climate',()=>{
 assert.equal(timelineFor(crop('wheat'),'2024-12-31'),null);
 assert.equal(timelineFor(crop('wheat'),'2026-01-01'),null);
 const t=timelineFor(crop('maize'),'2025-12-31');
 assert.ok(t.beyond_2025);
 assert.equal(t.stages[0].covered_2025_days,1);
 assert.equal(t.stages[1].covered_2025_days,0);
 assert.equal(dayIndex('2025-12-31'),364);
 const v=cropIndicators(fake(),crop('maize'),'2025-12-31');
 assert.equal(v.total.gdd.value,null);
 assert.equal(v.stages[1].totals.etc.value,null);
 assert.equal(v.stages.reduce((n,s)=>n+s.rows.length,0),1);
});
test('GDD and water calculations use crop Kc stage and do not treat missing as zero',()=>{
 const result=cropIndicators(fake(),crop('wheat'),'2025-01-01');
 assert.equal(result.stages[0].totals.gdd.value,42); // 20+22 with base 0
 assert.equal(result.stages[0].totals.eto.value,9);
 assert.equal(result.stages[0].totals.etc.value,3.15); // 0.35*(4+5)
 assert.equal(result.stages[0].totals.precipitation.value,10);
 assert.equal(result.stages[0].climatic_balance.value,6.85);
 assert.equal(result.stages[0].totals.gdd.valid_days,2);
 assert.equal(result.stages[0].potential_cold_days,1);
 assert.equal(result.stages[0].cold_evaluated_days,2);
 assert.equal(result.stages[1].totals.gdd.value,null);
 assert.equal(result.stages[1].potential_cold_days,0);
});
test('changing crop uses exact same already-fetched weather data, different GDD/Kc',()=>{
 const data=fake();
 const wheat=cropIndicators(data,crop('wheat'),'2025-01-01');
 const maize=cropIndicators(data,crop('maize'),'2025-01-01');
 assert.equal(wheat.total.gdd.value,42);
 assert.equal(maize.total.gdd.value,22);
 assert.equal(maize.total.etc.value,3.6);
 assert.deepEqual(data.datasets.temperature.daily.map(x=>x.value),[20,22]);
});

test('IMERG fallback is explicit when NASA POWER rainfall has only null observations',()=>{
 const data=fake();
 data.datasets.precipitation_power.daily=[{date:'2025-01-01',value:null}];
 data.datasets.precipitation={daily:[{date:'2025-01-01',value:8}]};
 const r=cropIndicators(data,crop('wheat'),'2025-01-01');
 assert.match(r.rainfall_source,/GPM IMERG/);
 assert.equal(r.stages[0].totals.precipitation.value,8);
});
