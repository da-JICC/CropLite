// Small-field geodesic area & representative point, using WGS84 lon/lat GeoJSON.
// Backend independently validates the submitted polygon and returns authoritative metadata.
const R = 6371008.8;
const radians = n => n * Math.PI / 180;
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment = (a,b,c) => c[0] >= Math.min(a[0],b[0]) && c[0] <= Math.max(a[0],b[0]) && c[1] >= Math.min(a[1],b[1]) && c[1] <= Math.max(a[1],b[1]);
function intersects(a,b,c,d) {
  const s=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];
  if(((s[0]>1e-12&&s[1]<-1e-12)||(s[0]<-1e-12&&s[1]>1e-12))&&((s[2]>1e-12&&s[3]<-1e-12)||(s[2]<-1e-12&&s[3]>1e-12))) return true;
  return s.some((v,i)=>Math.abs(v)<1e-12 && (i<2 ? onSegment(a,b,i===0?c:d) : onSegment(c,d,i===2?a:b)));
}
function inside([x,y],ring) {
  let yes=false;
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    if((a[1]>y)!==(b[1]>y) && a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])>x) yes=!yes;
  }
  return yes;
}
export function buildRegion(vertices) {
  if(vertices.length<3 || vertices.length>40) throw new Error('Draw between 3 and 40 vertices.');
  if(vertices.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))||Math.abs(p[0])>180||Math.abs(p[1])>90)) throw new Error('Some coordinates are invalid.');
  if(new Set(vertices.map(p=>p.join(','))).size!==vertices.length) throw new Error('Do not repeat vertices.');
  const xs=vertices.map(p=>p[0]),ys=vertices.map(p=>p[1]);
  if(Math.max(...xs)-Math.min(...xs)>0.1||Math.max(...ys)-Math.min(...ys)>0.1) throw new Error('For this prototype, draw a field smaller than approximately 10 km.');
  for(let i=0;i<vertices.length;i++) for(let j=i+1;j<vertices.length;j++) {
    if(Math.abs(i-j)===1||(i===0&&j===vertices.length-1)) continue;
    if(intersects(vertices[i],vertices[(i+1)%vertices.length],vertices[j],vertices[(j+1)%vertices.length])) throw new Error('The polygon edges intersect. Correct its shape.');
  }
  const ring=[...vertices,vertices[0]];
  const doubleArea=vertices.reduce((v,a,i)=>v+cross([0,0],a,vertices[(i+1)%vertices.length]),0);
  if(Math.abs(doubleArea)<1e-10) throw new Error('The polygon has no valid area.');
  let longitude=vertices.reduce((v,a,i)=>v+(a[0]+vertices[(i+1)%vertices.length][0])*cross([0,0],a,vertices[(i+1)%vertices.length]),0)/(3*doubleArea);
  let latitude=vertices.reduce((v,a,i)=>v+(a[1]+vertices[(i+1)%vertices.length][1])*cross([0,0],a,vertices[(i+1)%vertices.length]),0)/(3*doubleArea);
  if(!inside([longitude,latitude],vertices)) {
    // Choose the center of an inside scanline for concave fields.
    const ys = [vertices.reduce((s,p)=>s+p[1],0)/vertices.length, ...vertices.map((p,i)=>(p[1]+vertices[(i+1)%vertices.length][1])/2)];
    for (const y of ys) {
      const xs=vertices.flatMap((a,i)=>{const b=vertices[(i+1)%vertices.length];return (a[1]>y)!==(b[1]>y)?[a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1])]:[];}).sort((a,b)=>a-b);
      if(xs.length>=2) {longitude=(xs[0]+xs[1])/2;latitude=y;break;}
    }
  }
  const sqM=Math.abs(vertices.reduce((sum,a,i)=>{const b=vertices[(i+1)%vertices.length];return sum + radians(b[0]-a[0])*(Math.sin(radians(a[1]))+Math.sin(radians(b[1])));},0)*R*R/2);
  return {
    id:'selected-field',
    geometry:{type:'Polygon',coordinates:[ring]},
    areaHectares:sqM/10000,
    representativePoint:{latitude,longitude},
    vertexCount:vertices.length
  };
}
