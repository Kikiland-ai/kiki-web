import {expect,it} from 'vitest';
import {sidebands,sampleDsb,spectrumPosition} from './dsb-math';
import {DsbVisualSchema} from '../../contracts/teaching-visual';
import visual from '../../fixtures/dsb-sc-visual.json';
it('places equal sidebands symmetrically around the absent carrier reference',()=>{
  for(const fm of [10,100,200]){
    const {lower,upper}=sidebands(fm,2000);
    expect(lower).toBe(2000-fm); expect(upper).toBe(2000+fm);
    expect(spectrumPosition(lower,2000,250)+spectrumPosition(upper,2000,250)).toBeCloseTo(600);
  }
  expect(spectrumPosition(1900,2000,250)).toBeCloseTo(197.6);
  expect(spectrumPosition(2100,2000,250)).toBeCloseTo(402.4);
  expect(spectrumPosition(2000,2000,250)).toBe(300);
});
it('plots the signed product rather than an envelope or a sum',()=>{
  const values=Array.from({length:801},(_,i)=>sampleDsb(100,2000,i/800*.02));
  for(const v of values) {expect(v.product).toBe(v.message*v.carrier);expect(Math.abs(v.product)).toBeLessThanOrEqual(1);}
  expect(values.some(v=>v.product<-.9)).toBe(true);expect(values.some(v=>v.product>.9)).toBe(true);
});
it('rejects invalid analytic inputs and incompatible visual parameters',()=>{
  for(const fm of [0,-1,NaN,Infinity,2000,2100])expect(()=>sidebands(fm,2000)).toThrow();
  expect(DsbVisualSchema.safeParse(visual).success).toBe(true);
  expect(DsbVisualSchema.safeParse({...visual,messageRangeHz:{min:10,max:2000,step:10}}).success).toBe(false);
  expect(DsbVisualSchema.safeParse({...visual,messageFrequencyHz:500}).success).toBe(false);
});
