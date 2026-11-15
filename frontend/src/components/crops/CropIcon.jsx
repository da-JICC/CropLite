import React from 'react';

// The catalogue IDs map one-to-one to their own illustrations.
// For species present in the supplied reference use the supplied artwork;
// for the remaining eight the illustrations are species-specific SVGs.
const ILLUSTRATIONS = {
  'wheat': '/crops/wheat.png',
  'maize': '/crops/maize.png',
  'rice': '/crops/rice.png',
  'soybean': '/crops/soybean.png',
  'sorghum': '/crops/sorghum.png',
  'barley': '/crops/barley.svg',
  'papa': '/crops/papa.png',
  'girasol': '/crops/girasol.png',
  'poroto-seco': '/crops/poroto-seco.png',
  'repollo': '/crops/repollo.svg',
  'arveja-verde': '/crops/arveja-verde.png',
  'tomate': '/crops/tomate.png',
  'avena': '/crops/avena.svg',
  'mani': '/crops/mani.svg',
  'cebolla-seca': '/crops/cebolla-seca.svg',
  'pimiento-dulce': '/crops/pimiento-dulce.svg',
  'remolacha-azucarera': '/crops/remolacha-azucarera.svg',
  'algodon': '/crops/algodon.png',
  'alfalfa-heno': '/crops/alfalfa-heno.svg',
  'melon': '/crops/melon.png',
};

export default function CropIcon({cropId, name, className='', decorative=false}) {
  const src=ILLUSTRATIONS[cropId];
  return <img className={`terra-crop-icon ${className}`.trim()}
    src={src || '/crops/wheat.png'} alt={decorative ? '' : (name || cropId || 'Crop')}
    aria-hidden={decorative ? true : undefined}/>;
}
