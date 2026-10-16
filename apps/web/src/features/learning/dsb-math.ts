/** Known analytic model only; source strings are never evaluated as formulas. */
export function sidebands(messageHz:number,carrierHz:number){
  if(!Number.isFinite(messageHz)||!Number.isFinite(carrierHz)||messageHz<=0||carrierHz<=messageHz)throw new Error('Use positive frequencies with message below carrier.');
  return {lower:carrierHz-messageHz,upper:carrierHz+messageHz};
}
export function sampleDsb(messageHz:number,carrierHz:number,timeSeconds:number){
  sidebands(messageHz,carrierHz);
  const message=Math.sin(2*Math.PI*messageHz*timeSeconds),carrier=Math.cos(2*Math.PI*carrierHz*timeSeconds);
  return {message,carrier,product:message*carrier};
}
export function spectrumPosition(hz:number,carrierHz:number,spanHz:number){return 44+(hz-(carrierHz-spanHz))/(2*spanHz)*512;}
