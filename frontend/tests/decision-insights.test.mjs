import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cropInsights,rotationInsights} from '../src/components/recommendations/decisionInsights.mjs';
const component=readFileSync(new URL('../src/components/recommendations/AgriculturalDecisions.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const map=readFileSync(new URL('../src/components/maps/FieldSelectionMap.jsx',import.meta.url),'utf8');

test('thermal and development conclusions change with the crop, using actual scenario fields',()=>{
  const good=cropInsights({scenario_results:{a:{thermal_fit_pct:90,gdd_fit_pct:100,rain_etc_ratio:null},b:{thermal_fit_pct:80,gdd_fit_pct:100}}});
  const poor=cropInsights({scenario_results:{a:{thermal_fit_pct:20,gdd_fit_pct:50,rain_etc_ratio:.5}}});
  assert.equal(good.highlights[0].tone,'positive');
  assert.equal(poor.highlights[0].tone,'caution');
  assert.match(poor.highlights.find(x=>x.key==='water').description,/riego/);
  assert.equal(good.rainRatio,null);
});

test('missing agronomic or climatic inputs do not produce positive conclusions',()=>{
  const empty=cropInsights({scenario_results:{a:{thermal_fit_pct:null,gdd_fit_pct:undefined,rain_etc_ratio:null}}});
  assert.deepEqual(empty.highlights,[]);
});

test('rotation explanation is based on actual dates, crop family, interval and score',()=>{
  const plan={score:77.8,gap_days:19,crops:[{crop_id:'soybean',crop_name:'Soja',sow_date:'2027-01-15',harvest_date:'2027-04-25',family:'Fabaceae'},{crop_id:'wheat',crop_name:'Trigo',sow_date:'2027-05-15',harvest_date:'2027-09-15',family:'Poaceae'}]};
  const result=rotationInsights(plan,[{crop_id:'wheat',crop_name:'Trigo'}]);
  assert.match(result.whyOrder,/Trigo lidera/);
  assert.match(result.evidence.find(x=>x.key==='transition').value,/19 días/);
  assert.match(result.evidence.find(x=>x.key==='score').value,/78\/100/);
});

test('UI keeps one map, live sources, tabs and no redundant ranking jargon',()=>{
  assert.match(app,/<FieldSelectionMap region=\{region\} onRegionChange=\{setRegion\}/);
  assert.match(component,/SeasonalEvidence/);
  assert.match(component,/role="group" aria-label="Variable del gráfico"/);
  assert.match(component,/Clima y temporada/);
  assert.match(component,/¿Por qué este orden\?/);
  assert.doesNotMatch(component,/terra-decision-crop-metrics/);
  assert.doesNotMatch(component,/terra-decision-criteria/);
  assert.doesNotMatch(component,/terra-decision-notice/);
  assert.ok(map.length>3000);
});


test('multiyear rotation explanation reports the actual three-year sequence',()=>{
  const plan={score:78.3,gap_days:[90,75],reasons:['Alterna familias reales.'],crops:[
    {crop_id:'wheat',crop_name:'Trigo',sow_date:'2027-05-01',harvest_date:'2027-09-01',family:'Poaceae',planning_year:2027},
    {crop_id:'papa',crop_name:'Papa',sow_date:'2028-01-01',harvest_date:'2028-04-15',family:'Solanaceae',planning_year:2028},
    {crop_id:'girasol',crop_name:'Girasol',sow_date:'2029-01-01',harvest_date:'2029-05-01',family:'Asteraceae',planning_year:2029},
  ]};
  const info=rotationInsights(plan,[plan.crops[0]]);
  assert.equal(info.planningYears.length,3);
  assert.match(info.evidence.find(x=>x.key==='calendar').value,/2029/);
  assert.match(info.evidence.find(x=>x.key==='transition').value,/90 días y 75 días/);
  assert.ok(info.reasons.length);
});
