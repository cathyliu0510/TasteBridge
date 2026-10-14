import {byId} from './shared/engine.mjs?v=20261008.1';
import {escape} from './shared/ui.mjs?v=20261008.1';
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
// Pure reversible weights: native scroll, rather than elapsed time, is the clock.
export function journeyFrame(value){
 const progress=clamp(value);
 return {progress,seeds:1-smooth((progress-.16)/.38),picks:smooth((progress-.5)/.31),travel:Math.pow(Math.sin(smooth(progress)*Math.PI),2)};
}
export function memoryRiver(a,b,active,newMemory=null){
 const readers={a,b};
 return `<div class="memory-river" data-active-reader="${active}" aria-label="${a.length+b.length} of 10 favorites selected">${['a','b'].map(reader=>`<div class="memory-light-row reader-${reader}" data-memory-reader="${reader}"><span>${reader==='a'?'Reader 1':'Reader 2'}</span>${Array.from({length:5},(_,index)=>{const id=readers[reader][index],isNew=id&&newMemory?.reader===reader&&newMemory.id===id;return `<i class="memory-star ${id?'lit':''} ${isNew?'new-star':''}" data-memory-index="${index+1}" data-lit="${Boolean(id)}" ${id?`data-memory-id="${id}" title="${escape(byId(id).title)}"`:''}><span class="sr-only">${id?escape(byId(id).title):'Not selected'}</span></i>`;}).join('')}</div>`).join('')}</div>`;
}
