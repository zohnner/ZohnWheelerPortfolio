import roofing from './roofing.mjs';
import hvac from './hvac.mjs';
import foundation from './foundation.mjs';
import generic from './generic.mjs';

export const PRESETS = { roofing, hvac, foundation, generic };

export function getPreset(industry) {
  return typeof industry === 'string' && Object.hasOwn(PRESETS, industry) ? PRESETS[industry] : PRESETS.generic;
}
