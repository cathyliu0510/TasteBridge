import {byId} from './shared/engine.mjs?v=20261008.2';
import {bookTile,svg,escape} from './shared/ui.mjs?v=20261008.2';
import {readerConnection} from './desk-interactions.mjs?v=20261008.2';
import {reasonHTML} from './shared/ui.mjs?v=20261008.2';

export const readerName=reader=>reader==='a'?'Reader 1':'Reader 2';
export function readingShelf(ids,reader){
 return Array.from({length:5},(_,index)=>{
  const book=byId(ids[index]);
  return book?`<button class="seed-slot filled" data-remove="${book.id}" aria-label="Remove ${escape(book.title)} from ${readerName(reader)} favorites">${bookTile(book,{compact:true})}<span class="slot-remove">${svg('close')}</span></button>`:`<span class="seed-slot vacant" aria-label="Empty favorite slot ${index+1}"><span>${index+1}</span>${svg('plus')}</span>`;
 }).join('');
}
export function catalogueSelection(book,a,b,reader){
 const current=reader==='a'?a:b,other=reader==='a'?b:a,selected=current.includes(book.id),otherSelected=other.includes(book.id);
 const otherReader=reader==='a'?'b':'a';
 return {selected,label:selected?'Selected':otherSelected?`${readerName(otherReader)} picked this`:book.kind==='mystery'?'Mystery':book.kind==='fantasy'?'Fantasy':'Fantasy / Mystery',ariaLabel:`${selected?'Remove':'Add'} ${book.title} ${selected?'from':'to'} ${readerName(reader)} favorites${otherSelected?`; also picked by ${readerName(otherReader)}`:''}`};
}
export function readerEvidenceHTML(result,reader,favorites,exploration,{includeReason=true}={}){
 const connection=readerConnection(result,reader,favorites),fit=connection.fit;
 return `<section class="reader-evidence reader-${reader}" aria-label="Evidence for ${readerName(reader)}">${includeReason?reasonHTML(result,reader):''}<button class="evidence-seed" data-seed="${connection.seed.id}" data-reader="${reader}"><span>From your five</span><strong>${escape(connection.seed.title)}</strong><span aria-hidden="true">↗</span></button><div class="evidence-tags">${connection.sharedTags.map(theme=>`<button data-theme="${escape(theme)}" data-reader="${reader}" aria-pressed="${exploration?.kind==='theme'&&exploration.reader===reader&&exploration.theme===theme}">${escape(theme)}</button>`).join('')}</div><div class="reader-fit" data-fit="${fit.level}"><span class="fit-label">${fit.label}</span><span class="fit-track" aria-hidden="true">${Array.from({length:3},(_,index)=>`<i class="${index<fit.filled?'active':''}"></i>`).join('')}</span><small>Approximate sample-theme fit</small></div></section>`;
}
