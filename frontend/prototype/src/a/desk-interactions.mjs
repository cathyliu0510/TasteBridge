import {byId} from './shared/engine.mjs?v=20261008.1';

export function sampleFit(value){
 const score=Number.isFinite(value)?value:0;
 if(score>=.7)return {level:'strong',label:'More sample overlap',filled:3};
 if(score>=.5)return {level:'some',label:'Some sample overlap',filled:2};
 return {level:'limited',label:score>0?'Limited sample overlap':'No sample overlap',filled:score>0?1:0};
}
export function readerConnection(result,reader,favorites){
 const reason=result.reasons[reader],seed=byId(reason.seedId);
 if(!seed||!favorites.includes(seed.id))throw new Error('The reference must belong to this reader’s five favorites.');
 const sharedTags=reason.tags.filter(theme=>seed.tags.includes(theme)&&result.book.tags.includes(theme));
 return {seed,sharedTags,fit:sampleFit(reader==='a'?result.fitA:result.fitB)};
}
export function themeFavorites(favorites,theme){return favorites.map(byId).filter(book=>book?.tags.includes(theme));}
export function favoriteReferences(results,id){
 return results.map(result=>({result,readers:['a','b'].filter(reader=>result.reasons[reader].seedId===id)})).filter(item=>item.readers.length);
}
export function shortlistText(results,choice=null){
 if(results.length!==5)throw new Error('A shortlist needs exactly five recommendations.');
 const lines=['TasteBridge · sample shortlist','',...results.map((result,index)=>`${index+1}. ${result.book.title} — ${result.book.author}`)];
 const chosen=results.find(result=>result.book.id===choice);
 if(chosen)lines.push('',`Our next read: ${chosen.book.title} — ${chosen.book.author}`);
 return lines.join('\n');
}
export const copyShortlistText=async(text,clipboard=globalThis.navigator?.clipboard)=>{
 if(typeof clipboard?.writeText!=='function')return false;
 try{await clipboard.writeText(text);return true;}catch{return false;}
};
