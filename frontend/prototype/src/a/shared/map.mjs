import {byId,profile,project} from './engine.mjs?v=20261008.2';
import {escape,svg} from './ui.mjs?v=20261008.2';
const NS='http://www.w3.org/2000/svg';
export class TasteMap{
 constructor(container,{dark=false,onSelect=()=>{}}={}){
  this.container=container;this.onSelect=onSelect;this.dark=dark;this.zoom=1;this.offset={x:0,y:0};this.selected=null;
  container.innerHTML=`<svg class="map-svg" viewBox="0 0 760 430" role="img" aria-label="Sample connections between favorites and recommendations"></svg><div class="map-tooltip"></div><div class="map-controls"><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="reset" aria-label="Reset map position">${svg('reset')}</button></div>`;
  this.svg=container.querySelector('svg');this.tooltip=container.querySelector('.map-tooltip');
  container.querySelectorAll('[data-zoom]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.zoom==='reset'){this.zoom=1;this.offset={x:0,y:0};}else this.zoom=Math.max(.8,Math.min(2.5,this.zoom+(btn.dataset.zoom==='in'?.2:-.2)));this.transform();}));
  this.svg.addEventListener('pointerdown',e=>{if(e.target.closest('.map-node'))return;this.drag={x:e.clientX,y:e.clientY,ox:this.offset.x,oy:this.offset.y};this.svg.setPointerCapture(e.pointerId);});
  this.svg.addEventListener('pointermove',e=>{if(!this.drag)return;const rect=this.svg.getBoundingClientRect();this.offset={x:this.drag.ox+(e.clientX-this.drag.x)*760/rect.width,y:this.drag.oy+(e.clientY-this.drag.y)*430/rect.height};this.transform();});
  this.svg.addEventListener('pointerup',()=>this.drag=null);
  this.svg.addEventListener('pointercancel',()=>this.drag=null);
 }
 update(a,b,results,selected=null){
  this.a=a;this.b=b;this.results=results;this.selected=selected;
  const all=[...new Set([...a,...b,...results.map(r=>r.book.id)])];
  const raw=all.map(id=>({id,p:project(byId(id).vector)}));
  const xs=raw.map(x=>x.p.x),ys=raw.map(x=>x.p.y);const xmin=Math.min(-1,...xs),xmax=Math.max(1,...xs),ymin=Math.min(-1,...ys),ymax=Math.max(1,...ys);
  const convert=p=>({x:85+(p.x-xmin)/(xmax-xmin)*590,y:70+(p.y-ymin)/(ymax-ymin)*260});
  this.positions=new Map(raw.map((x,i)=>[x.id,{...convert(x.p),dx:(i%3-1)*8,dy:(i%4-1.5)*7}]));
  const point=id=>{const p=this.positions.get(id);return {x:p.x+p.dx,y:p.y+p.dy};};
  const center=ids=>ids.length?convert(project(profile(ids))):{x:ids===a?210:550,y:215};
  const ca=center(a),cb=center(b);const ink=this.dark?'#e5e2d9':'#1b2834',muted=this.dark?'#b6bcc4':'#6c747a';
  const color=id=>results.some(r=>r.book.id===id)?'var(--gold)':a.includes(id)?'var(--a)':'var(--b)';
  const seedLines=[a,b].map((ids,i)=>ids.map(id=>{const p=point(id),c=i?cb:ca;return `<path d="M${c.x},${c.y} L${p.x},${p.y}" stroke="${i?'var(--b)':'var(--a)'}" stroke-opacity=".15" fill="none"/>`;}).join('')).join('');
  const selectedResult=results.find(r=>r.book.id===selected);
  const evidenceLines=selectedResult?['a','b'].map(r=>{const p=point(selected),s=point(selectedResult.reasons[r].seedId);return `<path class="evidence-line" d="M${s.x},${s.y} Q${(s.x+p.x)/2},${Math.min(s.y,p.y)-35} ${p.x},${p.y}" fill="none" stroke="var(--${r})" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>`;}).join(''):'';
  const nodes=all.map(id=>{const book=byId(id),p=point(id),rank=results.findIndex(r=>r.book.id===id),isBridge=rank>=0,isSelected=id===selected;
  return `<g class="map-node" transform="translate(${p.x},${p.y})" tabindex="0" role="button" data-id="${id}" aria-label="${escape(book.title)}${isBridge?', recommendation '+(rank+1):', favorite'}"><title>${escape(book.title)}</title><circle class="node-hit" r="22" fill="transparent"/><circle r="${isBridge?(isSelected?18:14):6}" fill="${color(id)}" fill-opacity="${isBridge?'.12':'.18'}"/><circle r="${isBridge?4:3.5}" fill="${color(id)}"/>${isBridge?`<text y="-21" text-anchor="middle" fill="${ink}" font-size="12" font-family="Georgia">0${rank+1}</text>`:''}${isSelected?`<circle r="22" fill="none" stroke="${color(id)}" stroke-width=".6"/><text x="0" y="38" text-anchor="middle" fill="${ink}" font-size="12">${escape(book.title.length>31?book.title.slice(0,28)+'…':book.title)}</text>`:''}</g>`;
  }).join('');
  this.svg.innerHTML=`<defs><pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="${muted}" opacity=".15"/></pattern></defs><rect width="760" height="430" fill="url(#grid)"/><g class="map-content"><ellipse cx="${ca.x}" cy="${ca.y}" rx="105" ry="80" fill="none" stroke="var(--a)" stroke-opacity=".13"/><ellipse cx="${cb.x}" cy="${cb.y}" rx="105" ry="80" fill="none" stroke="var(--b)" stroke-opacity=".13"/>${seedLines}${evidenceLines}${nodes}<text x="${ca.x}" y="${Math.min(400,ca.y+105)}" text-anchor="middle" fill="var(--a)" font-size="13">Reader 1 · ${a.length} books</text><text x="${cb.x}" y="${Math.min(400,cb.y+105)}" text-anchor="middle" fill="var(--b)" font-size="13">Reader 2 · ${b.length} books</text></g>`;
  this.group=this.svg.querySelector('.map-content');this.transform();
  this.svg.querySelectorAll('.map-node').forEach(node=>{
   const id=node.dataset.id;
   const activate=()=>this.onSelect(id);
   node.addEventListener('click',activate);
   node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
   node.addEventListener('pointerenter',()=>{this.tooltip.textContent=byId(id).title;this.tooltip.style.left='1rem';this.tooltip.style.top='1rem';this.tooltip.classList.add('show');});
   node.addEventListener('pointerleave',()=>this.tooltip.classList.remove('show'));
  });
 }
 transform(){this.group?.setAttribute('transform',`translate(${380+this.offset.x},${215+this.offset.y}) scale(${this.zoom}) translate(-380,-215)`);}
}
