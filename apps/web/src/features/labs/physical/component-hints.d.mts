import type {PhysicalPart,PhysicalRule} from '../../../contracts/physical-lab';
export function componentHint(part:PhysicalPart,parts:PhysicalPart[],rule?:PhysicalRule|null,pending?:string|null,step?:number):{title:string;detail:string;cue:string;current:boolean;step:string|null};
export function tooltipPosition(x:number,y:number,width:number,height:number,tipWidth:number,tipHeight:number):[number,number];
