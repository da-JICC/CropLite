import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const catalog = JSON.parse(readFileSync(resolve(root, 'src/data/cropTemperatureCatalog.json'), 'utf8'));
const crops = catalog.crops;

test('twenty supported crops are represented by stable ids', () => {
  assert.deepEqual(crops.map(c => c.id), ['wheat','maize','rice','soybean','sorghum','barley','papa','girasol','poroto-seco','repollo','arveja-verde','tomate','avena','mani','cebolla-seca','pimiento-dulce','remolacha-azucarera','algodon','alfalfa-heno','melon']);
  assert.equal(new Set(crops.map(c=>c.id)).size, 20);
});

test('all crops have locally available illustrations and scientific source metadata', () => {
  for (const crop of crops) {
    assert.ok(existsSync(resolve(root, 'public', crop.image.slice(1))), crop.id);
    assert.ok(crop.thermal.optimumClimateC.sourceUrl.startsWith('https://'));
    if (crop.thermal.heatReproductiveReferenceC !== null) assert.ok(crop.thermal.heatReproductiveSourceUrl?.startsWith('https://')); 
    assert.ok(crop.thermal.coldFloweringSourceUrl?.startsWith('https://') || crop.thermal.coldFloweringSource); 
  }
});

test('temperature types are kept distinct and mathematically consistent', () => {
  for (const crop of crops) {
    const t=crop.thermal;
    for (const v of [t.gddBaseC,t.gddUpperC,t.optimumClimateC.min,t.optimumClimateC.max]) {
      assert.ok(Number.isFinite(v), `${crop.id} missing temperature`);
    }
    assert.ok(t.gddBaseC < t.gddUpperC);
    assert.ok(t.optimumClimateC.min < t.optimumClimateC.max);
    if (t.coldFloweringReferenceC !== null) {
      assert.ok(t.coldFloweringRangeC.min <= t.coldFloweringReferenceC);
      assert.equal(t.coldFloweringRangeC.max, t.coldFloweringReferenceC);
    }
  }
});

test('basal and GDD upper values correspond exactly to attached TerraAI CSV', () => {
  const expected={wheat:[0,35],maize:[10,32],rice:[12,35],soybean:[10,40],sorghum:[10,30],barley:[0,30]};
  Object.assign(expected,{papa:[2,30],girasol:[8,30],'poroto-seco':[10,32],repollo:[4.5,30],'arveja-verde':[5,27],tomate:[7,28],avena:[0,30],mani:[10,35],'cebolla-seca':[4.5,35],'pimiento-dulce':[10,35],'remolacha-azucarera':[5,30],algodon:[12.5,35],'alfalfa-heno':[0,30],melon:[10,38]});
  for (const c of crops) assert.deepEqual([c.thermal.gddBaseC,c.thermal.gddUpperC],expected[c.id]);
});

test('manual heat and cold input fields have been removed from My Farm', () => {
  const src=readFileSync(resolve(root,'src/pages/MyFarm.jsx'),'utf8');
  assert.ok(!src.includes('Umbral calor (°C)'));
  assert.ok(!src.includes('Umbral frío (°C)'));
  assert.ok(src.includes('<CropSelector'));
});

test('changing crop or tab does not trigger NASA/Copernicus requests', () => {
  const app=readFileSync(resolve(root,'src/App.jsx'),'utf8');
  const tabs=readFileSync(resolve(root,'src/components/historical/HistoricalTabs.jsx'),'utf8');
  assert.ok(app.includes('cropId, setCropId'));
  assert.ok(app.includes('getEnvironmentalRegion(region.geometry'));
  assert.ok(!app.includes('useEffect') || !app.includes('[cropId, attempt]'));
  assert.ok(tabs.includes('onSelect={onCropSelect}'));
  assert.ok(tabs.includes("setTab('ndvi')"));
  assert.ok(!tabs.includes('getHistoricalRegion('));
});

test('temperature chart adds crop references without changing the NDVI chart', () => {
  const src=readFileSync(resolve(root,'src/pages/Environment.jsx'),'utf8');
  assert.ok(src.includes('<CropTemperatureChart rows={tempRows} crop={selectedCrop}/>'));
  assert.ok(src.includes('<ChartShell rows={ndviRows}>'));
  assert.ok(!src.includes('field-temp-exposures'));
});
