import {byId,TAGS,topTags} from './engine.mjs?v=20261008.2';
export const $=(s,p=document)=>p.querySelector(s);
export const $$=(s,p=document)=>[...p.querySelectorAll(s)];
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const icon=(type)=>({search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',check:'<path d="m5 12 4 4 10-10"/>',plus:'<path d="M12 5v14M5 12h14"/>',star:'<path d="m12 3 2.8 6 6.2.9-4.5 4.3 1 6.1-5.5-2.9-5.5 2.9 1-6.1L3 9.9l6.2-.9Z"/>',volume:'<path d="M4 9h4l5-4v14l-5-4H4ZM17 8c2 2 2 6 0 8M20 5c4 4 4 10 0 14"/>',moon:'<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"/>',map:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>'}[type]||'');
export const svg=(type)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon(type)}</svg>`;
export const brand=`<span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span>TasteBridge</span>`;
export function bookTile(book,{selected=false,compact=false}={}){
 const coverArt=new URL(`./covers/${book.id}.svg`,import.meta.url).href;
 return `<span class="book-object ${compact?'compact':''}" data-cover="${escape(book.id)}" style="--book:${book.color};--cover-art:url('${escape(coverArt)}')"><span class="book-top">${book.year}</span><span class="book-title">${escape(book.title)}</span><span class="book-author">${escape(book.author)}</span>${selected?`<span class="book-check">${svg('check')}</span>`:''}</span>`;
}
export function seedSlots(ids,reader){
 return Array.from({length:5},(_,i)=>ids[i]?`<button class="seed-slot filled" data-remove="${ids[i]}" aria-label="Remove ${escape(byId(ids[i]).title)} from Reader ${reader==='a'?'1':'2'}">${bookTile(byId(ids[i]),{compact:true})}<span class="slot-remove">${svg('close')}</span></button>`:`<span class="seed-slot vacant"><span>0${i+1}</span>${svg('plus')}</span>`).join('');
}
export function reasonHTML(result,reader){const r=result.reasons[reader],number=reader==='a'?'1':'2';return `<div class="reason reader-${reader}"><div class="reason-head"><span class="reader-symbol">${number}</span><span>For Reader ${number}</span></div><p>${escape(r.text)}</p></div>`;}
export function fitText(value){return value>=.7?'More shared themes':value>=.5?'Some shared themes':'Fewer shared themes';}
export function resultHTML(result,index,votes={}){
 return `<div class="detail-header"><span class="eyebrow">PICK 0${index+1}</span><h2>${escape(result.book.title)}</h2><p>${escape(result.book.author)} · ${result.book.year}</p></div><div class="reasons">${reasonHTML(result,'a')}${reasonHTML(result,'b')}</div><div class="votes-block"><h3>Would you read this together?</h3>${['a','b'].map((r,i)=>`<div class="vote-row" role="group" aria-label="Reader ${i+1}'s interest"><span>Reader ${i+1}</span><button data-vote="${r}:yes" aria-pressed="${votes[r]==='yes'}" class="${votes[r]==='yes'?'chosen':''}">Interested</button><button data-vote="${r}:no" aria-pressed="${votes[r]==='no'}" class="${votes[r]==='no'?'chosen':''}">Pass</button></div>`).join('')}<p class="vote-state" aria-live="polite">${votes.a==='yes'&&votes.b==='yes'?'Both interested. Confirm together when you are ready.':votes.a==='no'||votes.b==='no'?'Keep exploring the other books.':'Share your interest, then decide together.'}</p></div>`;
}
export function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500);}
export function bindDialog(dialog,onClose){
 dialog.addEventListener('click',e=>{if(e.target===dialog){dialog.close();onClose?.();}});
 dialog.addEventListener('cancel',onClose||(()=>{}));
 dialog.addEventListener('close',()=>requestAnimationFrame(()=>{
  const id=dialog.dataset.bookId;
  if(id)$(`[data-result="${id}"]`)?.focus({preventScroll:true});
 }));
}
export function motionPreference(){let m=matchMedia('(prefers-reduced-motion: reduce)').matches;try{m=localStorage.getItem('tastebridge-motion')==='off'||m;}catch{}return m;}
export function setMotion(reduced){document.documentElement.classList.toggle('reduce-motion',reduced);try{localStorage.setItem('tastebridge-motion',reduced?'off':'on');}catch{}}
export function makeRecorder(variant){
 const start=performance.now();let events=[];
 return {record(name,details={}){events.push({event:name,time_ms:Math.round(performance.now()-start),...details});},download(){const report={variant,fixture:'manual-tags-v1',only_this_tab:true,events};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`tastebridge-${variant}-session.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}};
}
