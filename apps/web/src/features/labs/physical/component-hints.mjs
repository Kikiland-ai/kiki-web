/* Shared labels for marker hover, mesh hover and keyboard focus. No lab actions. */
export function componentHint(part,parts,rule=null,pending=null,step=null){
  const interactive=parts.filter(p=>p.kind!=='body');
  const number=id=>interactive.findIndex(p=>p.id===id)+1;
  const name=id=>{const p=parts.find(p=>p.id===id);return p?`#${number(id)} ${p.label}`:id;};
  const group=part.id.startsWith('source.')?'Signal source':part.id.startsWith('modulator.')?'Balanced modulator':part.id.startsWith('detector.')?'Synchronous detector':part.id.startsWith('scope.')?'CRO':'Trainer';
  const role={input:'Input socket',output:'Output socket',control:'Control',display:'Display'}[part.kind]||'Component';
  let cue=part.kind==='control'?'Click to inspect or adjust this control.':'Click to inspect this component.';
  let current=false;
  if(rule?.kind==='connect'){
    if(part.id===rule.target){current=true;cue=pending===part.id?`Selected. Now click ${name(rule.other)}.`:`Start here. Click, then choose ${name(rule.other)}.`;}
    else if(part.id===rule.other){current=true;cue=pending===rule.target?'Connect here to finish this lead.':`Destination. First select ${name(rule.target)}.`;}
    else cue=`This step uses ${name(rule.target)} → ${name(rule.other)}.`;
  }else if(rule?.target===part.id){current=true;cue=rule.kind==='measure'?'Read the output here, then record it in Kiki’s guide.':rule.kind==='set'?'Adjust this control using Kiki’s floating guide.':'Click this component for the current step.';}
  return {title:name(part.id),detail:`${group} · ${role}`,cue,current,step:current&&step?`Step ${step}`:null};
}

export function tooltipPosition(x,y,width,height,tipWidth,tipHeight){
  let left=x+17,top=y+17;
  if(left+tipWidth>width-8)left=x-tipWidth-17;
  if(top+tipHeight>height-8)top=y-tipHeight-17;
  return [Math.max(8,Math.min(left,Math.max(8,width-tipWidth-8))),Math.max(8,Math.min(top,Math.max(8,height-tipHeight-8)))];
}
