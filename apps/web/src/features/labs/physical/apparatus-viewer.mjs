/* Portable glTF mesh viewer: physical materials, printed artwork, picking and orbit. */
export function clampPanel(x,y,width,height,panelWidth,panelHeight) {
  return [Math.max(8,Math.min(x,Math.max(8,width-panelWidth-8))),Math.max(8,Math.min(y,Math.max(8,height-panelHeight-8)))];
}
export function guidePosition(points,width,height,panelWidth,panelHeight,current) {
  const candidates=[current,[width-panelWidth-12,12],[12,12],[12,height-panelHeight-72],[width-panelWidth-12,height-panelHeight-72]]
    .map(([x,y])=>clampPanel(x,y,width,height,panelWidth,panelHeight));
  const collisions=([x,y])=>points.filter(p=>p[0]>x-30&&p[0]<x+panelWidth+30&&p[1]>y-30&&p[1]<y+panelHeight+30).length;
  return candidates.sort((a,b)=>collisions(a)-collisions(b))[0];
}
export const defaultCamera = () => ({ yaw: -.10, tilt: 1.22, zoom: 1, center: [.38, .02, .015], span: 3.0 });
export function projectPoint(point, camera, width, height) {
  const [x,y,z] = point.map((n,i) => n-camera.center[i]);
  const cx=Math.cos(camera.yaw),sx=Math.sin(camera.yaw),ct=Math.cos(camera.tilt),st=Math.sin(camera.tilt);
  const rx=x*cx-z*sx,rz=x*sx+z*cx,scale=Math.min(width/camera.span,height/1.60)*camera.zoom;
  return [width/2+rx*scale,height/2-(y*ct-rz*st)*scale,-y*st-rz*ct];
}
export function pickPart(parts, camera, width, height, x, y) {
  const scale=Math.min(width/camera.span,height/1.60)*camera.zoom;
  return parts.filter(p=>p.kind!=='body').map(p=>{
    const q=projectPoint(p.position,camera,width,height);
    return {part:p,d:Math.hypot(x-q[0],y-q[1]),r:Math.max(14,Math.max(p.size[0],p.size[2])*scale*.65)};
  }).filter(p=>p.d<=p.r).sort((a,b)=>a.d-b.d)[0]?.part || null;
}
function vectorRotation(point, quaternion) {
  if(!quaternion)return point;
  const [x,y,z,w]=quaternion,[px,py,pz]=point;
  const tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
  return [px+w*tx+y*tz-z*ty,py+w*ty+z*tx-x*tz,pz+w*tz+x*ty-y*tx];
}
export class ApparatusViewer {
  constructor(canvas,{onPick=()=>{},onHover=()=>{},onFrame=()=>{},onAdjust=()=>{}}={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera=defaultCamera();
    this.onPick=onPick;this.onHover=onHover;this.onFrame=onFrame;this.onAdjust=onAdjust;
    this.objects=[];this.parts=[];this.controls={};this.connections=[];this.selected=null;this.ghost=null;this.drag=null;this.pending=null;
    this.events=new AbortController();
    const listen=(type,handler,options={})=>canvas.addEventListener(type,handler,{...options,signal:this.events.signal});
    listen('pointerdown',e=>this.pointerDown(e));
    listen('pointermove',e=>this.pointerMove(e));
    listen('pointerup',e=>this.pointerUp(e));
    listen('pointercancel',()=>{this.drag=null;});
    listen('pointerleave',e=>this.onHover(null,e));
    listen('wheel',e=>{e.preventDefault();this.camera.zoom=Math.max(.65,Math.min(2.4,this.camera.zoom-e.deltaY*.001));this.schedule();},{passive:false});
    this.resize=new ResizeObserver(()=>this.schedule());this.resize.observe(canvas);
  }
  destroy(){this.events.abort();this.resize.disconnect();if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;}
  load(gltf,pack) {
    this.parts=pack.parts;this.controlSpecs=pack.controls;this.artwork=gltf.asset.extras?.artwork||{};
    const buffers=gltf.buffers.map(b=>Uint8Array.from(atob(b.uri.split(',')[1]),c=>c.charCodeAt(0)).buffer);
    const values=id=>{const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView];return new Float32Array(buffers[v.buffer],(v.byteOffset||0)+(a.byteOffset||0),a.count*3);};
    this.objects=gltf.nodes.filter(n=>n.mesh!==undefined).map(node=>{
      const mesh=gltf.meshes[node.mesh];return {node,primitives:mesh.primitives.map(p=>({vertices:values(p.attributes.POSITION),color:gltf.materials[p.material].pbrMetallicRoughness.baseColorFactor}))};
    });this.camera=defaultCamera();this.schedule();
  }
  update({selected,controls,connections,ghost,pending,targets=[],observation}) {
    this.selected=selected;this.targets=targets;this.observation=observation||this.observation;this.controls=controls||{};this.connections=connections||[];this.ghost=ghost;this.pending=pending;this.schedule();
  }
  view(mode) {
    this.camera=defaultCamera();
    if(mode==='trainer'){this.camera.center=[0,.04,0];this.camera.span=1.95;}
    if(mode==='scope'){this.camera.center=[1.23,.06,0];this.camera.span=1.15;}
    if(mode==='top')this.camera.tilt=Math.PI/2;
    this.schedule();
  }
  focus(id) { const p=this.parts.find(p=>p.id===id);if(!p)return;this.view(id.startsWith('scope.')?'scope':'trainer'); }
  pointer(e){const r=this.canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
  pointerDown(e){const [x,y]=this.pointer(e),part=pickPart(this.parts,this.camera,this.canvas.clientWidth,this.canvas.clientHeight,x,y);this.drag={x,y,lastX:x,lastY:y,part,mode:e.shiftKey&&part?.kind==='control'?'adjust':'orbit'};this.canvas.setPointerCapture(e.pointerId);}
  pointerMove(e){const [x,y]=this.pointer(e);if(!this.drag){this.onHover(pickPart(this.parts,this.camera,this.canvas.clientWidth,this.canvas.clientHeight,x,y),e);return;}
    this.onHover(null,e);
    if(this.drag.mode==='adjust'){this.onAdjust(this.drag.part,(x-this.drag.lastX)*.005,false);}
    else if(Math.hypot(x-this.drag.x,y-this.drag.y)>4){this.camera.yaw=Math.max(-.9,Math.min(.9,this.camera.yaw+(x-this.drag.lastX)*.005));this.camera.tilt=Math.max(.6,Math.min(Math.PI/2,this.camera.tilt+(y-this.drag.lastY)*.004));}
    this.drag.lastX=x;this.drag.lastY=y;this.schedule();
  }
  pointerUp(e){if(!this.drag)return;const [x,y]=this.pointer(e),d=this.drag;this.drag=null;if(Math.hypot(x-d.x,y-d.y)<6&&d.part)this.onPick(d.part);if(d.mode==='adjust')this.onAdjust(d.part,0,true);}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
  project(p){return projectPoint(p,this.camera,this.width,this.height);}
  polygon(points,fill,stroke){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
  faceData(object) {
    const {node}=object,faces=[],spec=node.extras||{};
    for(const primitive of object.primitives){const vs=primitive.vertices;for(let i=0;i<vs.length;i+=9){
      const world=[0,1,2].map(k=>{
        let v=[0,1,2].map(a=>vs[i+k*3+a]*node.scale[a]);v=vectorRotation(v,node.rotation);
        if(spec.indicator&&spec.parentTarget){const part=this.parts.find(p=>p.id===spec.parentTarget),control=this.controlSpecs[spec.parentTarget],value=this.controls[spec.parentTarget];
          if(part&&control&&typeof value==='number'){const t=(value-(control.minimum||0))/((control.maximum||1)-(control.minimum||0));const angle=(-.75+t*1.5)*Math.PI;const dx=node.translation[0]-part.position[0]+v[0],dz=node.translation[2]-part.position[2]+v[2];return[part.position[0]+dx*Math.cos(angle)-dz*Math.sin(angle),node.translation[1]+v[1],part.position[2]+dx*Math.sin(angle)+dz*Math.cos(angle)];}}
        return v.map((n,a)=>n+node.translation[a]);
      });
      const points=world.map(v=>this.project(v)),[a,b,c]=world,u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
      const light=.69+.31*Math.abs((n[0]*.3+n[1]+n[2]*.3)/(l*1.086));
      faces.push({points,depth:points.reduce((s,p)=>s+p[2],0)/3,color:`rgb(${primitive.color.slice(0,3).map(v=>Math.round(v*light*255)).join(',')})`});
    }}return faces.sort((a,b)=>b.depth-a.depth);
  }
  artworkPaths(){const c=this.ctx;for(const path of this.artwork.paths||[]){c.beginPath();path.points.map(p=>this.project(p)).forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.lineWidth=Math.max(.65,path.width*this.scale);c.strokeStyle=path.color;c.stroke();}}
  artworkLabels(raised=false){const c=this.ctx;for(const l of this.artwork.labels||[]){if((l.position[1]>.12)!==raised)continue;const [x,y,z]=l.position,p=this.project([x,y,z]),px=this.project([x+1,y,z]),pz=this.project([x,y,z+1]);c.save();c.transform(px[0]-p[0],px[1]-p[1],pz[0]-p[0],pz[1]-p[1],p[0],p[1]);c.font=`600 ${l.size*1.35}px system-ui,sans-serif`;c.fillStyle=l.color;c.fillText(l.text,0,0);c.restore();}}
  cables(){const c=this.ctx,edges=[...this.connections];if(this.ghost?.kind==='connect')edges.push([this.ghost.target,this.ghost.other]);edges.forEach(([a,b],i)=>{
    const p=this.parts.find(p=>p.id===a),q=this.parts.find(p=>p.id===b);if(!p||!q)return;const first=this.project(p.position),last=this.project(q.position),mid=this.project([(p.position[0]+q.position[0])/2,.34+(i%3)*.04,(p.position[2]+q.position[2])/2]);
    c.save();if(i>=this.connections.length)c.setLineDash([7,5]);c.lineCap='round';c.lineWidth=5;c.strokeStyle='rgba(20,23,23,.25)';c.beginPath();c.moveTo(first[0]+2,first[1]+3);c.quadraticCurveTo(mid[0]+2,mid[1]+3,last[0]+2,last[1]+3);c.stroke();c.lineWidth=3;c.strokeStyle=['#ab3e31','#262d2c','#a88128'][i%3];c.beginPath();c.moveTo(first[0],first[1]);c.quadraticCurveTo(mid[0],mid[1],last[0],last[1]);c.stroke();c.restore();
  });}
  screen(){
    const p=this.parts.find(p=>p.id==='scope.display');if(!p)return;
    const c=this.ctx,[x,y,z]=p.position,[sx,,sz]=p.size,pt=(u,v)=>this.project([x+(u-.5)*sx,y+.009,z+(v-.5)*sz]);
    c.save();c.lineWidth=.6;c.strokeStyle='#36534b';
    for(let i=1;i<8;i++){const a=pt(i/8,0),b=pt(i/8,1);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
    for(let i=1;i<6;i++){const a=pt(0,i/6),b=pt(1,i/6);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
    const probe=this.connections.find(e=>e[1]==='scope.input')?.[0];
    const key=probe==='modulator.output'?'dsb_sc_v':probe==='detector.output'?'recovered_v':null;
    const samples=key?this.observation?.traces?.[key]:null;
    if(this.controls['trainer.power']&&samples?.length){c.strokeStyle='#a5dc8d';c.lineWidth=1.5;c.beginPath();samples.forEach((v,i)=>{const q=pt(i/(samples.length-1),.5-v*.29);if(i)c.lineTo(q[0],q[1]);else c.moveTo(q[0],q[1]);});c.stroke();}
    c.restore();
  }
  draw(){
    if(!this.ctx)return;this.width=this.canvas.clientWidth;this.height=this.canvas.clientHeight;if(!this.width||!this.height)return;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.width*dpr;this.canvas.height=this.height*dpr;const c=this.ctx;c.scale(dpr,dpr);this.scale=Math.min(this.width/this.camera.span,this.height/1.60)*this.camera.zoom;
    const gradient=c.createLinearGradient(0,0,0,this.height);gradient.addColorStop(0,'#eeeee8');gradient.addColorStop(1,'#dcded5');c.fillStyle=gradient;c.fillRect(0,0,this.width,this.height);
    for(const id of ['trainer.body','scope.body']){const p=this.parts.find(p=>p.id===id);if(!p)continue;const q=this.project([p.position[0],-.16,p.position[2]]);c.save();c.filter='blur(12px)';c.fillStyle='rgba(47,45,36,.18)';c.beginPath();c.ellipse(q[0],q[1]+14,p.size[0]*this.scale*.54,p.size[2]*this.scale*.28,0,0,Math.PI*2);c.fill();c.restore();}
    const layers=[...new Set(this.objects.map(o=>o.node.extras?.layer??3))].sort((a,b)=>a-b);
    for(const layer of layers){if(layer>=3&&!this.printed){this.artworkPaths();this.artworkLabels();this.printed=true;}const objects=this.objects.filter(o=>(o.node.extras?.layer??3)===layer).sort((a,b)=>this.project(b.node.translation)[2]-this.project(a.node.translation)[2]);for(const o of objects)for(const f of this.faceData(o))this.polygon(f.points,f.color);}
    this.printed=false;this.artworkLabels(true);this.screen();this.cables();
    for(const id of new Set([this.selected,this.pending,...(this.targets||[])])){const p=this.parts.find(p=>p.id===id);if(!p)continue;const q=this.project(p.position),r=Math.max(16,Math.max(p.size[0],p.size[2])*this.scale*.70);c.save();c.strokeStyle='#2867ae';c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.ellipse(q[0],q[1],r,r*.74,0,0,Math.PI*2);c.stroke();c.restore();}
    this.onFrame(this.parts.filter(p=>p.kind!=='body').map(p=>({id:p.id,point:this.project(p.position)})));
  }
}
