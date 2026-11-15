/**
 * TerraAI — transparent 2025 agronomic SCREENING, not a trained ML model.
 * The environmental dataset is retrieved once by the App. Changing crop/plan
 * recomputes in memory and never calls NASA or Copernicus again.
 *
 * Scope: retrospective 2025 analogue, NOT weather forecasting, certified
 * suitability, yield prediction, or soil/irrigation diagnosis.
 */
import {shiftDay,dayIndex,timelineFor,cropIndicators,YEAR_END} from '../phenology/phenologyEngine.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value,minimum=0,maximum=1) => Math.max(minimum,Math.min(maximum,value));
const round = (value,digits=1) => finite(value)?Number(value.toFixed(digits)):null;
const mean = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
const BOTANICAL_FAMILIES = Object.freeze({wheat:'Poaceae',maize:'Poaceae',rice:'Poaceae',soybean:'Fabaceae',sorghum:'Poaceae',barley:'Poaceae'});
const range = (number,low,high) => finite(number) && finite(low) && finite(high) && number>=low && number<=high;
const count = (map,start,end,field='value') => {
  let total=0,valid=0;
  for(let d=start;d<=end;d=shiftDay(d,1)){
    const val=map.get(d)?.[field];
    if(finite(val)){total+=val;valid++;}
  }
  return {sum:round(total,2),valid};
};
const asMap = (analysis,key) => new Map((analysis?.datasets?.[key]?.daily||[]).map(item=>[item.date,item]));
export const RECOMMENDATION_METHODOLOGY = Object.freeze({
  id:'terraai-explainable-screening-2025-v1',
  type:'interpretable_rules_not_trained_ml',
  input_year:2025,
  minimum_temperature_coverage:0.9,
  minimum_water_coverage:0.9,
  sowing_step_days:14,
  transition_buffer_days:14,
  limitations:[
    'Retrospective comparison using 2025 data; NOT a forecast for the next growing year.',
    'Ranking is a relative internal index, not a probability of success or a yield forecast.',
    'FAO Kc/stages are approximate calendars; flowering was not observed.',
    'Rainfall versus ETc is not measured water deficit: irrigation, runoff and soil storage are excluded.',
    'NDVI and SMAP moisture cannot independently identify future crops or field fertility.',
    'A rotation cannot be certified without pH, nutrients, field management, disease, irrigation supply and local validation.',
  ]
});

/** Evaluate one fully visible crop cycle under 2025's observed weather. */
export function evaluatePlanting(analysis,crop,thermal,sowDate){
  const timeline=timelineFor(crop,sowDate);
  if(!timeline || timeline.estimated_maturity_date>YEAR_END) return null;
  const indicators=cropIndicators(analysis,crop,sowDate);
  if(!indicators) return null;
  const temperature=asMap(analysis,'temperature');
  const rainData=analysis?.datasets?.precipitation_power?.daily?.some(x=>finite(x.value))
    ? 'precipitation_power' : 'precipitation';
  const precipitation=asMap(analysis,rainData);
  const expected=timeline.estimated_cycle_days;
  const temps=[];
  const extrema=[];
  for(let d=sowDate;d<=timeline.estimated_maturity_date;d=shiftDay(d,1)) {
    const reading=temperature.get(d);
    if(finite(reading?.value))temps.push(reading.value);
    if(finite(reading?.max_c)&&finite(reading?.min_c))extrema.push(reading);
  }
  const temperatureCoverage=temps.length/expected;
  if(temperatureCoverage < RECOMMENDATION_METHODOLOGY.minimum_temperature_coverage) return null;
  const optimum=thermal?.thermal?.optimumClimateC;
  // A broad climatic band, not stage-specific damage or physiological optimum.
  const optimumFraction=finite(optimum?.min)&&finite(optimum?.max)
    ?temps.filter(t=>range(t,optimum.min,optimum.max)).length/temps.length:null;
  const gdd=indicators.total.gdd;
  const target=crop.gdd_cycle_target_degree_days;
  const gddProgress=finite(target?.min)&&target.min>0&&gdd.valid_days/expected>=0.9
    ?clamp((gdd.value||0)/target.min):null;
  // Missing inputs never receive a favorable default score.
  // All ranked crops must share the same two valid thermal criteria.
  if(!finite(optimumFraction) || !finite(gddProgress))return null;
  const climateScore=(optimumFraction+gddProgress)/2;
  const rain=count(precipitation,sowDate,timeline.estimated_maturity_date);
  const cropWater=indicators.total.etc;
  const vpd=asMap(analysis,'vpd');
  const radiation=asMap(analysis,'radiation');
  const moisture=asMap(analysis,'soil_moisture');
  const vpdContext=count(vpd,sowDate,timeline.estimated_maturity_date);
  const radiationContext=count(radiation,sowDate,timeline.estimated_maturity_date);
  const rootzoneContext=count(moisture,sowDate,timeline.estimated_maturity_date,'rootzone_moisture_m3_m3');
  const waterComplete=rainData==='precipitation_power' && rain.valid/expected>=RECOMMENDATION_METHODOLOGY.minimum_water_coverage &&
    cropWater.valid_days/expected>=RECOMMENDATION_METHODOLOGY.minimum_water_coverage &&
    finite(cropWater.value) && cropWater.value>0;
  const rainEtcRatio=waterComplete?round(rain.sum/cropWater.value,2):null;
  // Rainfall alone is a contextual qualifier, NOT a water stress classifier.
  const score=round(climateScore*100,0);
  const vulnerabilities=[];
  const positives=[];
  if(finite(optimumFraction)){
    if(optimumFraction>=0.65)positives.push('Good match with the indicative thermal climate band during the simulated crop cycle.');
    else vulnerabilities.push('Several mean temperatures fall outside the indicative climatic band.');
  }
  if(finite(gddProgress)){
    if(gddProgress>=0.98)positives.push('Accumulated heat is near or above the indicative minimum for the growing cycle.');
    else vulnerabilities.push('Accumulated heat is below the catalog’s minimum GDD target.');
  }
  const coldDays=indicators.stages.reduce((sum,stage)=>sum+stage.potential_cold_days,0);
  if(coldDays>0)vulnerabilities.push(`${coldDays} day(s) cross indicative cold references during potential stages; no damage is confirmed.`);
  if(waterComplete){
    if(rainEtcRatio<0.7)vulnerabilities.push('Scenario rainfall is below estimated ETc; irrigation and stored water are unknown.');
    else positives.push('Scenario precipitation is relatively close to estimated ETc; water sufficiency is not established.');
  }else vulnerabilities.push('Insufficient coverage or inconsistent rainfall/ET₀ time references; water comparison unavailable.');
  if(crop.id==='rice')vulnerabilities.push('Flooded rice: water availability and flooding management have not been verified.');
  return {
    cropId:crop.id, cropName:crop.name, family:BOTANICAL_FAMILIES[crop.id]||null,
    sowDate, harvestDate:timeline.estimated_maturity_date,cycleDays:expected,
    score,rankingBasis:'mean temperature versus general climatic band and minimum GDD; not ML',
    scoreComponents:{optimumFraction:round(optimumFraction,3),gddProgress:round(gddProgress,3)},
    climateCoverage:round(temperatureCoverage,3),waterCoverage:round(Math.min(rain.valid,cropWater.valid_days)/expected,3),
    gdd:finite(gdd.value)?round(gdd.value):null,gddTarget:target||null,
    precipitationMm:rain.valid?rain.sum:null,etcMm:cropWater.value,
    rainEtcRatio,waterComplete,coldReferenceCrossings:coldDays,
    context:{vpdMeanKpa:vpdContext.valid?round(vpdContext.sum/vpdContext.valid,2):null,
      solarRadiationMjM2:radiationContext.valid?radiationContext.sum:null,
      rootzoneMoistureMean:rootzoneContext.valid?round(rootzoneContext.sum/rootzoneContext.valid,3):null,
      vpdValidDays:vpdContext.valid,radiationValidDays:radiationContext.valid,soilValidDays:rootzoneContext.valid},
    positives,vulnerabilities, timeline,
    provenance:{temperature:'NASA POWER daily 2025 · regional estimate',
      water:'NASA POWER PRECTOTCORR (LST) preferred + FAO-56 ET₀; rainfall does not equal available water',
      crop:'TerraAI crop CSV + FAO/JICA stage calendar',
      rainfall:rainData==='precipitation_power'?'NASA POWER PRECTOTCORR (LST)':'GPM IMERG (UTC; different daily time reference)'}
  };
}

/** Calendar dates refer solely to historical 2025. Do not relabel them as future forecasts. */
export function buildCropRecommendations(analysis,crops,thermalCrops){
  if(!analysis?.datasets) return {status:'unavailable',ranked:[],rotations:[],coverage:'No environmental data'};
  const thermalById=new Map(thermalCrops.map(c=>[c.id,c]));
  const evaluated=[];
  for(const crop of crops){
    for(let day=0;day<365;day+=RECOMMENDATION_METHODOLOGY.sowing_step_days){
      const sowDate=shiftDay('2025-01-01',day);
      const scenario=evaluatePlanting(analysis,crop,thermalById.get(crop.id),sowDate);
      if(scenario) evaluated.push(scenario);
    }
  }
  const ranked=crops.map(crop=>evaluated.filter(v=>v.cropId===crop.id)
    .sort((a,b)=>b.score-a.score||a.sowDate.localeCompare(b.sowDate))[0]||null)
    .filter(Boolean).sort((a,b)=>b.score-a.score||a.cropName.localeCompare(b.cropName));
  if(!ranked.length)return {status:'insufficient',ranked:[],rotations:[],
    coverage:'Insufficient daily temperature data to rank complete 2025 scenarios.',
    methodology:RECOMMENDATION_METHODOLOGY};
  const rotations=[];
  // Reuse valid single-season windows; only cross-family sequences and a documented
  // 14-day planning buffer. These are feasible calendars, not disease-free claims.
  const eligible=evaluated.filter(candidate=>candidate.score>=45);
  for(const a of eligible){
    for(const b of eligible){
      if(!a.family || !b.family || a.family===b.family || a.cropId===b.cropId)continue;
      const earliestNext=shiftDay(a.harvestDate,RECOMMENDATION_METHODOLOGY.transition_buffer_days+1);
      if(b.sowDate<earliestNext)continue;
      const gap=dayIndex(b.sowDate)-dayIndex(a.harvestDate)-1;
      rotations.push({id:`${a.cropId}-${a.sowDate}_${b.cropId}-${b.sowDate}`,
        crops:[a,b],gapDays:gap,meanCompatibility:round((a.score+b.score)/2,0),
        label:`${a.cropName} → ${b.cropName}`,source:'2025 calendar · retrospective assessment',
        warnings:['Alternating botanical families does not guarantee disease prevention.',
          'Soil conditions, preparation, stored water and market access were not evaluated.']});
    }
  }
  rotations.sort((a,b)=>b.meanCompatibility-a.meanCompatibility||a.gapDays-b.gapDays);
  const seen=new Set();
  const bestRotations=[];
  for(const option of rotations){
    if(seen.has(option.label))continue;
    seen.add(option.label);bestRotations.push(option);
    if(bestRotations.length===3)break;
  }
  return {status:'screened',ranked,rotations:bestRotations,evaluatedCount:evaluated.length,
    coverage:'2025 daily series · planting dates evaluated every 14 days; scenarios require at least 90% thermal coverage.',
    methodology:RECOMMENDATION_METHODOLOGY,
    missingCrops:crops.filter(c=>!ranked.some(r=>r.cropId===c.id)).map(c=>c.name)};
}
