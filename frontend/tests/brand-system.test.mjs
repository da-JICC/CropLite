import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const ids = ['wheat','maize','rice','soybean','sorghum','barley','potato','sunflower','bean','cabbage'];
const allCrops = JSON.parse(fs.readFileSync(path.join(root,'src/data/cropTemperatureCatalog.json'),'utf8')).crops;
const aliases = {papa:'potato',girasol:'sunflower','poroto-seco':'bean',repollo:'cabbage'};

// SHA-256 hashes recorded from the CropLite satellite/annual version before the
// prior graphical rework. This prevents newly invented pictograms creeping in.
const originalIllustrations = {
  barley:'b7bb33cb951bd5bd903326108cd33c487bdb0c23b47a53ecebebafdaf350a646',
  bean:'571576fdd32de5e36062605ec9fd5e22a1a59481088c99df6223d876b4eeaa15',
  cabbage:'1bcb6ecce61e9486232dd430da399fe4db1bd9e9c626cbf4be2a32e530f15c92',
  maize:'5bfa4a83d3241fdc08125770a3a28debd6822ad60c5521c438ae99784c7d6647',
  potato:'a1e55156a250c5dbfe673bf650fc82f09f4c5e273d306304ddbaf0e3128c6cba',
  rice:'cd2a782afdea5c6c2e864c4b80296d1022ec4df8bd8621eacf512b28dbc8cab8',
  sorghum:'e569907b90f1d6b813e08abec993aee5081771525db7e9ad185218876a3ac458',
  soybean:'9f7185d6ebdc57ada930c8d4f1ecde351e1e94f5a467c678eff21d3d05216193',
  sunflower:'377b3e6feba8beaee9ff063ed3d43c272b08d2e534cc8b81f2a6b084c61f449e',
  wheat:'20cda4ffe1d66becf230325c2b6fea7ce9be5b6b09337434d283a9110adbc4d9',
};

test('all ten crops use precisely the original pre-redesign artwork',()=>{
  assert.deepEqual(ids.slice().sort(),allCrops.map(c=>aliases[c.id]||c.id).sort());
  for(const id of ids){
    const svg=fs.readFileSync(path.join(root,`public/crops/${id}.svg`));
    assert.match(svg.toString(),/<svg\b/);
    assert.equal(createHash('sha256').update(svg).digest('hex'),originalIllustrations[id],`original artwork changed for ${id}`);
  }
});

test('approved CropLite emblem, wordmark and inverse badge are preserved as vector paths',()=>{
  const mark=fs.readFileSync(path.join(root,'public/brand/croplite-symbol.svg'),'utf8');
  const horizontal=fs.readFileSync(path.join(root,'public/brand/croplite-horizontal.svg'),'utf8');
  const badge=fs.readFileSync(path.join(root,'public/brand/croplite-badge.svg'),'utf8');
  assert.match(mark,/103D28/);assert.match(mark,/8FAA5A/);
  assert.match(horizontal,/role="img"/);
  assert.doesNotMatch(horizontal,/<text\b/,'The approved wordmark should not be re-typeset');
  assert.match(badge,/viewBox="0 0 496 183"/);
  assert.ok(fs.existsSync(path.join(root,'public/brand/croplite-app.svg')));
  const component=fs.readFileSync(path.join(root,'src/components/ui/CropLiteBrand.jsx'),'utf8');
  assert.match(component,/croplite-horizontal\.svg/);
  assert.match(component,/croplite-badge\.svg/);
});

test('brand tokens and responsive navigation remain without backend changes',()=>{
  const css=fs.readFileSync(path.join(root,'src/brand-system.css'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
  assert.match(css,/--cl-forest:#103D28/);assert.match(css,/--cl-olive:#8FAA5A/);
  assert.match(css,/@media\(max-width:750px\)/);
  assert.match(app,/croplite-mobile-menu/);assert.match(app,/CropLiteBrand/);
  assert.match(app,/AgriculturalDecisions/);
});
