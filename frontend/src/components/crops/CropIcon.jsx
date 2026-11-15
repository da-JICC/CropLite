import React from 'react';

/** Original crop illustrations, preserved from the pre-brand-redesign CropLite version. */
const IDS = new Set(['wheat','maize','rice','soybean','sorghum','barley','potato','sunflower','bean','cabbage']);
const ALIASES = {papa:'potato',girasol:'sunflower','poroto-seco':'bean',repollo:'cabbage'};
export function CropIcon({cropId, name, size=48, className='', decorative=false}) {
  const normalized = ALIASES[cropId] || cropId;
  const id = IDS.has(normalized) ? normalized : 'wheat';
  return <img className={`crop-illustration ${className}`.trim()} src={`/crops/${id}.svg`}
    width={size} height={size} alt={decorative ? '' : (name || id)}
    aria-hidden={decorative ? 'true' : undefined} loading="lazy" />;
}
export default CropIcon;
