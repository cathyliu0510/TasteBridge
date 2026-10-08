import {byId,profile,project} from './shared/engine.mjs?v=20261008.2';
import {escape,svg} from './shared/ui.mjs?v=20261008.2';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const stableJitter=id=>[...id].reduce((sum,letter)=>sum+letter.charCodeAt(0),0);

// A projection of the exact sample vectors used by ranking, with a small,
// deterministic label-separation offset. This prototype does not use UMAP.
export class DeskGalaxy{
 constructor(container,{onSelect=()=>{},onFavorite=()=>{}}={}){
  this.container=container;this.onSelect=onSelect;this.onFavorite=onFavorite;
  this.zoom=1;this.offset={x:0,y:0};this.selected=null;this.focused=null;
  this.lifecycle=new AbortController();
  container.innerHTML=`<svg class="map-svg galaxy-svg" viewBox="0 0 760 430" tabindex="0" role="group" aria-label="Taste galaxy. Select a book to explore its shared themes."><desc>Numbered stars are the five recommendations. The other stars are your favorites. Use arrow keys to move between stars, then Enter to inspect a book. Drag the background to pan. Use the zoom controls to get closer.</desc></svg><div class="map-tooltip" role="tooltip" style="left:1rem;top:1rem"></div><div class="map-controls galaxy-controls" aria-label="Taste galaxy view controls"><button class="galaxy-zoom" data-zoom="in" aria-label="Zoom in">+</button><button class="galaxy-zoom" data-zoom="out" aria-label="Zoom out">−</button><button class="galaxy-reset" data-zoom="reset" aria-label="Reset galaxy view">${svg('reset')}</button></div><span class="galaxy-status sr-only" role="status" aria-live="polite"></span>`;
  this.svg=container.querySelector('.map-svg');this.tooltip=container.querySelector('.map-tooltip');
  const listen=(target,event,handler,options={})=>target.addEventListener(event,handler,{...options,signal:this.lifecycle.signal});
  container.querySelectorAll('[data-zoom]').forEach(button=>listen(button,'click',()=>{
   if(button.dataset.zoom==='reset'){this.zoom=1;this.offset={x:0,y:0};}
   else this.zoom=clamp(this.zoom+(button.dataset.zoom==='in'?.25:-.25),.75,3);
   this.transform();this.announceZoom();
  }));
  listen(this.svg,'pointerdown',event=>{
   if(event.target.closest('.map-node')||event.button!==0)return;
   this.drag={x:event.clientX,y:event.clientY,ox:this.offset.x,oy:this.offset.y};
   this.svg.setPointerCapture(event.pointerId);this.svg.classList.add('is-dragging');
  });
  listen(this.svg,'pointermove',event=>{
   if(!this.drag){const id=this.pointerBook(event,null,true);if(id)this.showBook(id);return;}
   const rect=this.svg.getBoundingClientRect(),scale=Math.max(.01,Math.min(rect.width/760,rect.height/430));
   this.offset={x:clamp(this.drag.ox+(event.clientX-this.drag.x)/scale,-700,700),y:clamp(this.drag.oy+(event.clientY-this.drag.y)/scale,-380,380)};
   this.transform();
  });
  const release=()=>{this.drag=null;this.svg.classList.remove('is-dragging');};
  listen(this.svg,'pointerup',release);listen(this.svg,'pointercancel',release);listen(this.svg,'lostpointercapture',release);
  listen(this.svg,'keydown',event=>{
   if(event.target.closest('.map-node'))return;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();const first=this.svg.querySelector('.map-node');first?.focus();return;
   }
   if(['+','=','-','0','Home'].includes(event.key)){
    event.preventDefault();const action=event.key==='-'?'out':['0','Home'].includes(event.key)?'reset':'in';
    container.querySelector(`[data-zoom="${action}"]`).click();
   }
  });
  // Zoom only with an intentional modifier so ordinary page scrolling stays native.
  listen(this.svg,'wheel',event=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();this.zoom=clamp(this.zoom+(event.deltaY<0?.12:-.12),.75,3);this.transform();this.announceZoom();
  },{passive:false});
  if(typeof ResizeObserver==='function'){
   this.resizeObserver=new ResizeObserver(()=>this.updateHitTargets());this.resizeObserver.observe(this.svg);
  }
 }
 update(a,b,results,selected=null){
  this.tooltip.classList.remove('show');
  this.a=a;this.b=b;this.results=results;this.selected=selected;
  this.resultLookup=new Map(results.map((result,index)=>[result.book.id,{...result,index}]));
  const ids=[...new Set([...results.map(result=>result.book.id),...a,...b])];
  const raw=ids.map(id=>({id,p:project(byId(id).vector)}));
  const xs=raw.map(book=>book.p.x),ys=raw.map(book=>book.p.y);
  const xmin=Math.min(-1,...xs),xmax=Math.max(1,...xs),ymin=Math.min(-1,...ys),ymax=Math.max(1,...ys);
  const convert=point=>({x:85+(point.x-xmin)/(xmax-xmin)*590,y:70+(point.y-ymin)/(ymax-ymin)*255});
  this.positions=new Map(raw.map(({id,p})=>{
   const point=convert(p),jitter=stableJitter(id);
   return [id,{x:point.x+(jitter%5-2)*7,y:point.y+(Math.floor(jitter/5)%5-2)*6}];
  }));
  const centers=[convert(project(profile(a))),convert(project(profile(b)))];
  const clusterPaths=[a,b].map((seeds,index)=>seeds.map(id=>{
   const point=this.positions.get(id),center=centers[index];
   return `<path class="cluster-line" d="M${center.x},${center.y} L${point.x},${point.y}" stroke="var(--${index?'b':'a'})" stroke-opacity=".12" fill="none"/>`;
  }).join('')).join('');
  const evidencePaths=results.map(result=>['a','b'].map(reader=>{
   const point=this.positions.get(result.book.id),seed=this.positions.get(result.reasons[reader].seedId);
   return `<path class="evidence-line" data-result="${result.book.id}" data-seed="${result.reasons[reader].seedId}" data-reader="${reader}" d="M${seed.x},${seed.y} Q${(seed.x+point.x)/2},${Math.min(seed.y,point.y)-35} ${point.x},${point.y}" fill="none" stroke="var(--${reader})" stroke-width="1.5" opacity="0"/>`;
  }).join('')).join('');
  const nodes=ids.map(id=>{
   const book=byId(id),point=this.positions.get(id),result=this.resultLookup.get(id),reader=a.includes(id)&&b.includes(id)?'both':a.includes(id)?'a':'b';
   const color=result?'var(--gold)':reader==='b'?'var(--b)':'var(--a)';
   const label=result?`Bridge book ${result.index+1} of 5: ${book.title}. Open both readers' reasons.`:`${reader==='both'?'Both readers’':reader==='a'?'Reader 1’s':'Reader 2’s'} favorite: ${book.title}. Explore its sample themes.`;
   return `<g class="map-node ${result?'is-bridge':'is-favorite'}" data-id="${id}" data-reader="${reader}" data-selected="${id===selected}" data-hover="false" transform="translate(${point.x},${point.y})" tabindex="0" role="button" aria-label="${escape(label)}" ${result?`aria-pressed="${id===selected}"`:''}><title>${escape(book.title)}</title><circle class="node-hit" r="23" fill="transparent"/><circle class="node-halo" r="${result?16:10}" fill="${color}" fill-opacity=".13"/><circle class="node-core" r="${result?5:4}" fill="${color}"/>${reader==='both'&&!result?'<circle r="7" fill="none" stroke="var(--b)" stroke-width="1.6"/>':''}<circle class="node-ring" r="22" fill="none" stroke="${color}" stroke-width=".8" opacity="${id===selected?1:0}"/>${result?`<text class="node-number" y="-23" text-anchor="middle" fill="var(--ink)" font-size="13">${result.index+1}</text>`:''}<text class="node-label" y="39" text-anchor="middle" fill="var(--ink)" font-size="13" opacity="${id===selected?1:0}">${escape(book.title.length>32?book.title.slice(0,29)+'…':book.title)}</text></g>`;
  }).join('');
  this.svg.innerHTML=`<desc>Numbered stars are bridge books. Select a star to inspect a favorite or recommendation. Arrow keys move focus between nearby stars; Enter opens the book.</desc><g class="map-content"><ellipse cx="${centers[0].x}" cy="${centers[0].y}" rx="112" ry="80" fill="none" stroke="var(--a)" stroke-opacity=".11"/><ellipse cx="${centers[1].x}" cy="${centers[1].y}" rx="112" ry="80" fill="none" stroke="var(--b)" stroke-opacity=".11"/>${clusterPaths}${evidencePaths}${nodes}<text x="${centers[0].x}" y="${Math.min(405,centers[0].y+106)}" text-anchor="middle" fill="var(--a)" font-size="14">Reader 1</text><text x="${centers[1].x}" y="${Math.min(405,centers[1].y+106)}" text-anchor="middle" fill="var(--b)" font-size="14">Reader 2</text></g>`;
  this.group=this.svg.querySelector('.map-content');this.transform();
  this.svg.querySelectorAll('.map-node').forEach(node=>{
   const id=node.dataset.id;
   const activate=event=>{const target=event?.detail>0?this.pointerBook(event,id):id;this.focused=target;this.paintHighlight(target);this.resultLookup.has(target)?this.onSelect(target):this.onFavorite(target);};
   const show=event=>this.showBook(this.pointerBook(event,id));
   const hide=()=>{this.tooltip.classList.remove('show');this.paintHighlight(this.selected);};
   node.addEventListener('click',activate);
   node.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();this.neighbor(id,event.key)?.focus();}
   });
   node.addEventListener('pointerenter',show);node.addEventListener('pointerleave',hide);
   node.addEventListener('focus',show);node.addEventListener('blur',hide);
  });
  this.paintHighlight(selected);
 }
 showBook(id){
  this.focused=id;this.tooltip.textContent=byId(id).title;this.tooltip.classList.add('show');this.paintHighlight(id);
 }
 pointerBook(event,fallback=null,limit=false){
  if(!Number.isFinite(event?.clientX)||!Number.isFinite(event?.clientY)||!this.positions)return fallback;
  const matrix=this.group?.getScreenCTM();if(!matrix)return fallback;
  const determinant=matrix.a*matrix.d-matrix.b*matrix.c;if(!determinant)return fallback;
  const dx=event.clientX-matrix.e,dy=event.clientY-matrix.f;
  const point={x:(matrix.d*dx-matrix.c*dy)/determinant,y:(matrix.a*dy-matrix.b*dx)/determinant};
  let nearest=null,distance=Infinity;
  for(const [id,position] of this.positions){const current=Math.hypot(position.x-point.x,position.y-point.y);if(current<distance){nearest=id;distance=current;}}
  // Enlarged touch targets overlap for books with similar sample vectors.
  // Resolve to the nearest visible star instead of whichever SVG node is on top.
  if(limit&&distance*Math.hypot(matrix.a,matrix.b)>24)return fallback;
  return nearest||fallback;
 }
 neighbor(id,direction){
  const origin=this.positions.get(id),axis=['ArrowLeft','ArrowRight'].includes(direction)?'x':'y',sign=['ArrowLeft','ArrowUp'].includes(direction)?-1:1;
  const candidates=[...this.positions].filter(([other,point])=>other!==id&&(point[axis]-origin[axis])*sign>1);
  candidates.sort(([,a],[,b])=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  if(!candidates.length)return null;
  return [...this.svg.querySelectorAll('.map-node')].find(node=>node.dataset.id===candidates[0][0]);
 }
 paintHighlight(id){
  if(!this.resultLookup)return;
  const isBridge=this.resultLookup.has(id),related=new Set([id]);
  this.svg.querySelectorAll('.evidence-line').forEach(path=>{
   const active=isBridge?path.dataset.result===id:path.dataset.seed===id;
   path.classList.toggle('is-active',active);path.setAttribute('opacity',active?'.75':'0');
   if(active){related.add(path.dataset.seed);related.add(path.dataset.result);}
  });
  this.svg.querySelectorAll('.map-node').forEach(node=>{
   const active=node.dataset.id===id,selected=node.dataset.id===this.selected;
   node.dataset.hover=String(active);node.classList.toggle('is-connected',related.has(node.dataset.id));
   node.querySelector('.node-label').setAttribute('opacity',active||selected?'1':'0');
   node.querySelector('.node-ring').setAttribute('opacity',active||selected?'1':'0');
  });
 }
 transform(){
  this.group?.setAttribute('transform',`translate(${380+this.offset.x},${215+this.offset.y}) scale(${this.zoom}) translate(-380,-215)`);
  this.updateHitTargets();
  const buttons=this.container.querySelectorAll('[data-zoom]');
  buttons.forEach(button=>{if(button.dataset.zoom==='in')button.disabled=this.zoom>=3;if(button.dataset.zoom==='out')button.disabled=this.zoom<=.75;});
 }
 updateHitTargets(){
  const rect=this.svg.getBoundingClientRect(),scale=Math.min(rect.width/760,rect.height/430)*this.zoom;
  if(scale<=0)return;
  this.svg.style.setProperty('--galaxy-scale',String(scale));
  this.svg.querySelectorAll('.node-hit').forEach(node=>node.setAttribute('r',String(Math.max(23,23/scale))));
 }
 announceZoom(){this.container.querySelector('.galaxy-status').textContent=`Galaxy zoom ${Math.round(this.zoom*100)}%.`;}
 destroy(){this.lifecycle.abort();this.resizeObserver?.disconnect();}
}
