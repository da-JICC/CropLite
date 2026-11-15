import React from 'react';

/**
 * CropLite's approved artwork (November 2026).
 * Both lockups are traced directly from the approved logo board in /public/brand.
 * Do not re-typeset the wordmark or draw a substitute emblem in JSX.
 */
export function CropLiteBrand({compact=false, inverse=false, tagline=false, className=''}) {
  const src = compact
    ? '/brand/croplite-symbol.svg'
    : inverse
      ? '/brand/croplite-badge.svg'
      : '/brand/croplite-horizontal.svg';
  return <span className={`brand-lockup ${inverse?'brand-lockup--inverse':''} ${compact?'brand-lockup--compact':''} ${className}`.trim()}>
    <img className="brand-lockup__art" src={src} alt="CropLite" draggable="false" />
    {tagline && !compact && <small className="brand-lockup__tagline">PLAN SMARTER. GROW BETTER.</small>}
  </span>;
}
export default CropLiteBrand;
