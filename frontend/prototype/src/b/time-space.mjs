const TAU=Math.PI*2;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-t,3);
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x);};
const POSES={
 opening:{x:.64,y:.43,size:.37,yaw:.4,pitch:.24,roll:-.32,depth:1},
 select:{x:.24,y:.43,size:.29,yaw:.63,pitch:.3,roll:-.38,depth:1.18},
 reveal:{x:.5,y:.46,size:.61,yaw:.08,pitch:.08,roll:-.12,depth:1.8},
 results:{x:.72,y:.4,size:.35,yaw:.56,pitch:.23,roll:-.36,depth:1.25}
};

// An abstract photographic space made with points and projected geometry.
// This is a narrative camera. It never supplies or alters recommendation data.
export class TimeSpace{
 constructor(canvas){
  this.canvas=canvas;try{this.ctx=canvas.getContext('2d',{alpha:true});}catch{this.ctx=null;}this.scene='opening';this.reduced=false;
  canvas.dataset.renderer=this.ctx?'canvas-2d':'static-fallback';
  this.pose={...POSES.opening};this.from={...this.pose};this.to={...this.pose};this.phase=0;
  this.seeds={a:[],b:[]};this.frame=0;this.end=0;this.exploration={x:0,y:0};this.journeyProgress=0;
  this.resize=()=>{this.width=innerWidth;this.height=innerHeight;this.mobile=this.width<760;this.dpr=Math.min(devicePixelRatio||1,this.mobile?1.2:1.5);canvas.width=Math.round(this.width*this.dpr);canvas.height=Math.round(this.height*this.dpr);this.ctx?.setTransform(this.dpr,0,0,this.dpr,0,0);this.draw(performance.now());};
  this.resize();
  window.addEventListener('resize',this.resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;canvas.dataset.animation='paused';}else if(this.scene==='reveal'){this.setJourneyProgress(this.journeyProgress);}else{this.pose={...this.to};this.draw(performance.now());canvas.dataset.animation='static';}});
 }
 setScene(scene,{a=[],b=[],reduced=false}={}){
  const changed=scene!==this.scene;
  const inputChanged=a.join(',')!==this.seeds.a.join(',')||b.join(',')!==this.seeds.b.join(',');
  this.scene=scene;this.reduced=reduced;this.seeds={a:[...a],b:[...b]};
  this.canvas.dataset.scene=scene;this.canvas.dataset.memoryCount=String(a.length+b.length);
  this.canvas.dataset.motion=reduced?'reduced':'full';
  if(scene==='reveal'&&!reduced){this.setJourneyProgress(0);return;}
  this.from={...this.pose};this.to={...(POSES[scene]||POSES.opening)};
  if(this.mobile){this.to.x=.5;this.to.y=scene==='opening'?.37:scene==='results'?.29:.26;this.to.size=scene==='reveal'?.62:scene==='opening'?.6:.43;}
  if(changed)this.exploration={x:0,y:0};
  this.start=performance.now();this.duration=reduced?0:changed&&scene==='opening'?950:0;
  if(!this.ctx||reduced||document.hidden){cancelAnimationFrame(this.frame);this.frame=0;this.pose={...this.to};this.draw(this.start);this.canvas.dataset.animation=document.hidden?'paused':'static';return;}
  if(this.duration)this.animate(this.duration);
  else{cancelAnimationFrame(this.frame);this.frame=0;this.pose={...this.to};this.draw(this.start);this.canvas.dataset.animation='static';}
 }
 setJourneyProgress(value){
  if(this.scene!=='reveal'||this.reduced)return;
  cancelAnimationFrame(this.frame);this.frame=0;
  const progress=clamp(Number.isFinite(value)?value:0,0,1),travel=Math.pow(Math.sin(smooth(progress)*Math.PI),2),settle=smooth((progress-.55)/.45);
  this.journeyProgress=progress;this.phase=progress*.45;
  this.pose={x:.54+.16*settle,y:.44-.1*settle,size:.36+.25*travel-.02*settle,yaw:.4*(1-travel)+.05*travel,pitch:.24*(1-travel)+.02*travel,roll:-.32*(1-travel)-.08*travel,depth:1+1.05*travel+.18*settle};
  if(this.mobile){this.pose.x=.5;this.pose.y=.4-.04*settle;this.pose.size=.58+.27*travel-.03*settle;}
  this.to={...this.pose};this.canvas.dataset.scrollProgress=progress.toFixed(3);
  this.canvas.dataset.animation=document.hidden?'paused':'static';
  if(!document.hidden)this.draw(performance.now());
 }
 explore(x,y=0){
  if(!this.ctx||this.scene!=='opening'||this.reduced||document.hidden)return;
  this.exploration={x:clamp(x,-1,1),y:clamp(y,-1,1)};
  this.from={...this.pose};this.to={...POSES.opening,yaw:POSES.opening.yaw+x*.22,pitch:POSES.opening.pitch+y*.15,depth:1+Math.abs(x)*.16};
  if(this.mobile){this.to.x=.5;this.to.y=.37;this.to.size=.6;}
  this.start=performance.now();this.duration=650;this.animate(650);
 }
 animate(duration){
  cancelAnimationFrame(this.frame);this.end=this.start+duration;this.canvas.dataset.animation='moving';
  const tick=time=>{
   if(document.hidden){this.frame=0;this.canvas.dataset.animation='paused';return;}
   const progress=clamp((time-this.start)/Math.max(this.duration,1),0,1);
   const t=ease(progress);for(const key of Object.keys(this.to))this.pose[key]=lerp(this.from[key],this.to[key],t);
   this.phase=progress*(this.scene==='reveal'?.45:.065);this.draw(time);
   if(time<this.end)this.frame=requestAnimationFrame(tick);
   else{this.frame=0;this.pose={...this.to};this.draw(time);this.canvas.dataset.animation='static';}
  };
  this.frame=requestAnimationFrame(tick);
 }
 project(x,y,z){
  const p=this.pose,cy=Math.cos(p.yaw),sy=Math.sin(p.yaw),cp=Math.cos(p.pitch),sp=Math.sin(p.pitch),cr=Math.cos(p.roll),sr=Math.sin(p.roll);
  const x1=x*cy+z*sy,z1=-x*sy+z*cy,y1=y*cp-z1*sp,z2=y*sp+z1*cp;
  const scale=1/(1-z2*.115),radius=Math.min(this.width*this.pose.size,this.height*(this.mobile?.4:.54))*p.depth;
  return {x:this.width*p.x+(x1*cr-y1*sr)*radius*scale,y:this.height*p.y+(x1*sr+y1*cr)*radius*scale,scale};
 }
 ring(radius,z,offset=0,span=TAU){
  const ctx=this.ctx,segments=this.mobile?74:112;ctx.beginPath();
  for(let i=0;i<=segments;i++){const t=offset+i/segments*span,p=this.project(Math.cos(t)*radius,Math.sin(t)*radius,z);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}
 }
 draw(){
  if(!this.ctx)return;const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);
  const p=this.pose,cx=w*p.x,cy=h*p.y,r=Math.min(w*p.size,h*(this.mobile?.4:.54))*p.depth;
  // Broad darkness makes the aperture a volume rather than a line illustration.
  const aura=ctx.createRadialGradient(cx,cy,r*.36,cx,cy,r*1.45);
  aura.addColorStop(0,'rgba(2,11,13,.99)');aura.addColorStop(.55,'rgba(5,22,23,.78)');aura.addColorStop(.8,'rgba(115,138,125,.065)');aura.addColorStop(1,'rgba(3,13,15,0)');
  ctx.fillStyle=aura;ctx.fillRect(0,0,w,h);
  // Deep successive planes form a tunnel that the finite camera can approach.
  const layers=this.mobile?26:42;
  for(let i=layers;i>=0;i--){
   const depth=i/layers,z=-depth*5.8,radius=.87-depth*.06;
   this.ring(radius,z,this.phase*.08);
   ctx.lineWidth=i===0?1.1:.45;ctx.strokeStyle=`rgba(${i%4===0?'190,202,193':'94,129,133'},${.025+(1-depth)*.12})`;ctx.stroke();
  }
  // The band uses particles in depth; brightness comes from a rim, not a glow blob.
  const count=this.mobile?540:1280;
  for(let i=0;i<count;i++){
   const theta=hash(i+1)*TAU+this.phase*.12,spread=Math.pow(hash(i+500),2),radius=.88+spread*.28,z=(hash(i+1000)-.5)*.12;
   const point=this.project(Math.cos(theta)*radius,Math.sin(theta)*radius,z);
   const hot=(Math.sin(theta-.6)+1)/2,alpha=(.1+hot*.38)*(1-spread*.75);
   ctx.fillStyle=i%13===0?`rgba(209,188,145,${alpha*.7})`:`rgba(206,220,211,${alpha})`;
   const size=(i%39===0?1.8:.65)*point.scale;ctx.fillRect(point.x,point.y,size,size);
  }
  // A few broken filament arcs carry the restrained ice and amber material.
  for(let i=0;i<6;i++){
   this.ring(.884+i*.018,(i-3)*.017,.2+i*.14+this.phase*.08,Math.PI*(.87-i*.065));
   ctx.strokeStyle=i===0?'rgba(239,231,210,.84)':i===4?'rgba(202,186,151,.36)':`rgba(174,202,198,${.36-i*.03})`;
   ctx.lineWidth=i===0?1.4:.65;ctx.shadowColor='rgba(191,212,198,.23)';ctx.shadowBlur=i===0?5:0;ctx.stroke();
  }
  ctx.shadowBlur=0;
  // Sparse long exposure traces are decorative, with no ongoing motion loop.
  for(let i=0;i<(this.mobile?32:64);i++){
   const theta=hash(i+9000)*TAU,rad=1.14+hash(i+10000)*.42,point=this.project(Math.cos(theta)*rad,Math.sin(theta)*rad,(hash(i+11000)-.5)*.2);
   const end=this.project(Math.cos(theta+.013)*rad,Math.sin(theta+.013)*rad,0);
   ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.lineTo(end.x,end.y);ctx.strokeStyle=i%4===0?'rgba(209,188,145,.27)':'rgba(157,183,180,.2)';ctx.lineWidth=.6;ctx.stroke();
  }
  if(this.scene==='select'||this.scene==='reveal')this.drawMemories();
 }
 drawMemories(){
  const ctx=this.ctx;
  const weight=this.scene==='reveal'?1-smooth((this.journeyProgress-.16)/.38):1;
  if(weight<=0)return;ctx.save();ctx.globalAlpha=weight;
  for(const [reader,index] of [['a',0],['b',1]]){
   const ids=this.seeds[reader];if(!ids.length)continue;const color=index?'209,155,113':'146,195,214';
   const points=ids.map((id,i)=>{const theta=(index?-.22:Math.PI-.22)+(index?-1:1)*i*.19;return this.project(Math.cos(theta)*(1.25-i*.035),Math.sin(theta)*(1.25-i*.035),-.08-i*.16);});
   ctx.beginPath();points.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.lineWidth=.8;ctx.strokeStyle=`rgba(${color},.48)`;ctx.stroke();
   for(const pt of points){ctx.beginPath();ctx.arc(pt.x,pt.y,3.2,0,TAU);ctx.fillStyle=`rgba(${color},.92)`;ctx.fill();ctx.beginPath();ctx.arc(pt.x,pt.y,10,0,TAU);ctx.strokeStyle=`rgba(${color},.17)`;ctx.stroke();}
  }
  ctx.restore();
 }
}
