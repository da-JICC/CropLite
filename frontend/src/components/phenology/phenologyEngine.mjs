/** TerraAI 2025 phenological calendar scenarios and daily indicator aggregation.
 * Pure functions: a crop/date switch never makes a new external API request.
 * FAO Kc stages are approximate crop-cover stages, NOT observed flowering dates.
 */
export const YEAR_START = '2025-01-01';
export const YEAR_END = '2025-12-31';
export const STAGE_COLORS = {
  initial:'#b9d9a6', development:'#60b799', mid:'#5e9ec7', late:'#d6b36f'
};
const isNum = v => typeof v==='number' && Number.isFinite(v);
const parse = iso => new Date(`${iso}T12:00:00Z`);
export function shiftDay(iso, days) {
  const date=parse(iso); date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}
export function dayIndex(iso) {return Math.round((parse(iso)-parse(YEAR_START))/86400000);}
const sum = (rows, field) => {
  const data=rows.map(x=>x[field]).filter(isNum);
  return {value:data.length ? +data.reduce((a,b)=>a+b,0).toFixed(2) : null, valid_days:data.length};
};
const mean = (rows, field) => {
  const s=sum(rows, field);
  return {...s, value:s.value===null?null:+(s.value/s.valid_days).toFixed(3)};
};
const dailyMap=(analysis,key)=>new Map((analysis?.datasets?.[key]?.daily??[]).map(row=>[row.date,row]));

export function timelineFor(crop, sowDate) {
  if (!crop || !/^2025-\d\d-\d\d$/.test(sowDate || '') || !Number.isInteger(dayIndex(sowDate)) || dayIndex(sowDate)<0 || dayIndex(sowDate)>364) return null;
  let offset=0;
  const stages=crop.stages.map(stage=>{
    const start=shiftDay(sowDate,offset);
    const end=shiftDay(sowDate,offset+stage.duration_days-1);
    offset+=stage.duration_days;
    return {...stage,start,end,covered_2025_days:Math.max(0,
      Math.round((Math.min(parse(end).getTime(),parse(YEAR_END).getTime())-Math.max(parse(start).getTime(),parse(YEAR_START).getTime()))/86400000)+1)};
  });
  return {sow_date:sowDate,estimated_maturity_date:shiftDay(sowDate,offset-1),
    estimated_cycle_days:offset,stages,beyond_2025:shiftDay(sowDate,offset-1)>YEAR_END,
    basis:'Duraciones referenciales FAO/JICA por fase; no son hitos fenológicos observados ni pronóstico térmico.'};
}

export function cropIndicators(analysis, crop, sowDate) {
  const timeline=timelineFor(crop,sowDate);
  if (!timeline) return null;
  const temperature=dailyMap(analysis,'temperature');
  const eto=dailyMap(analysis,'eto');
  // Prefer POWER meteorology for consistent local-solar-time dates with ETo.
  const powerRain=dailyMap(analysis,'precipitation_power');
  const imergRain=dailyMap(analysis,'precipitation');
  const powerValid=[...powerRain.values()].some(r=>isNum(r.value));
  const rainKind=powerValid?'precipitation_power':'precipitation';
  const precipitation=powerValid?powerRain:imergRain;
  const soil=dailyMap(analysis,'soil_moisture');
  const stages=timeline.stages.map(stage=>{
    const rows=[];
    for (let d=stage.start;d<=stage.end && d<=YEAR_END;d=shiftDay(d,1)) {
      const t=temperature.get(d)??{};
      const et=eto.get(d)??{};
      const p=precipitation.get(d)??{};
      const sm=soil.get(d)??{};
      const avg=t.value;
      const gdd=isNum(avg)&&isNum(stage.gdd_base_c)
        ?Math.max(0,Math.min(avg,isNum(stage.gdd_upper_c)?stage.gdd_upper_c:avg)-stage.gdd_base_c):null;
      const etc=isNum(et.value)&&isNum(stage.kc)?et.value*stage.kc:null;
      const cold=stage.cold_reference_c && isNum(t.min_c)
        ?t.min_c <= stage.cold_reference_c.max_c : null;
      rows.push({date:d,temperature_mean_c:isNum(avg)?avg:null,temperature_min_c:isNum(t.min_c)?t.min_c:null,
        temperature_max_c:isNum(t.max_c)?t.max_c:null,gdd,eto:isNum(et.value)?et.value:null,
        etc,precipitation:isNum(p.value)?p.value:null,soil_surface:isNum(sm.value)?sm.value:null,
        soil_rootzone:isNum(sm.rootzone_moisture_m3_m3)?sm.rootzone_moisture_m3_m3:null,cold});
    }
    const totals={gdd:sum(rows,'gdd'),eto:sum(rows,'eto'),etc:sum(rows,'etc'),
      precipitation:sum(rows,'precipitation'),soil_surface:mean(rows,'soil_surface'),
      soil_rootzone:mean(rows,'soil_rootzone')};
    const common=rows.filter(r=>isNum(r.etc)&&isNum(r.precipitation));
    const climatic_balance={value:common.length?+(common.reduce((a,r)=>a+r.precipitation-r.etc,0)).toFixed(2):null,
      valid_days:common.length};
    const cold_values=rows.filter(r=>r.cold!==null);
    return {...stage,days_in_2025:rows.length,rows,totals,climatic_balance,
      potential_cold_days:cold_values.filter(r=>r.cold).length,cold_evaluated_days:cold_values.length};
  });
  let totalGdd=0;
  let observedGdd=0;
  for(const stage of stages){
    if(stage.totals.gdd.valid_days){totalGdd+=stage.totals.gdd.value;observedGdd+=stage.totals.gdd.valid_days;}
    stage.gdd_accumulated_from_sowing={value:observedGdd?+totalGdd.toFixed(2):null,valid_days:observedGdd};
  }
  return {...timeline,stages,source:'FAO stage lengths + crop CSV + NASA POWER daily datasets',
    rainfall_source:rainKind==='precipitation_power'?'NASA POWER PRECTOTCORR (LST)':'GPM IMERG (UTC; fechas pueden diferir)',
    total:{gdd:sum(stages.flatMap(s=>s.rows),'gdd'),eto:sum(stages.flatMap(s=>s.rows),'eto'),
      etc:sum(stages.flatMap(s=>s.rows),'etc'),precipitation:sum(stages.flatMap(s=>s.rows),'precipitation')},
    limitations:[
      'Etapas FAO aproximadas basadas en días, no floración o maduración detectadas por sensores.',
      'Kc es referencial por fase y ETc es una estimación bajo condiciones estándar; no ET medida.',
      'Precipitación − ETc es un balance climático parcial, NO una evaluación de estrés hídrico ni incorpora riego.',
      'Las referencias de frío inicial y floración no garantizan daño. La fase media solo puede contener floración.',
      'Los totales parciales no reemplazan días sin datos; revisar días válidos antes de interpretarlos.'
    ]};
}
