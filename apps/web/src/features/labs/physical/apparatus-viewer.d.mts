import type {PhysicalPack,PhysicalPart,PhysicalObservations} from '../../../contracts/physical-lab';
export type Point=[number,number];
export function clampPanel(x:number,y:number,width:number,height:number,panelWidth:number,panelHeight:number):Point;
export function guidePosition(points:Point[],width:number,height:number,panelWidth:number,panelHeight:number,current:Point):Point;
export class ApparatusViewer {
 constructor(canvas:HTMLCanvasElement,callbacks?:{onPick?:(part:PhysicalPart)=>void;onHover?:(part:PhysicalPart|null,event:PointerEvent)=>void;onFrame?:(points:{id:string;point:[number,number,number]}[])=>void;onAdjust?:(part:PhysicalPart,delta:number,commit:boolean)=>void});
 load(gltf:unknown,pack:PhysicalPack):void;
 update(state:{selected:string|null;controls:Record<string,string|number|boolean>;connections:[string,string][];pending:string|null;targets?:string[];observation?:PhysicalObservations|null}):void;
 view(mode:string):void;
 schedule():void;
 destroy():void;
}
