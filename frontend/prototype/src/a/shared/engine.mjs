import { CATALOG, byId, TAGS, DEMO } from './catalog.mjs?v=20261008.2';
export { CATALOG, byId, TAGS, DEMO };
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
export const cosine=(a,b)=>dot(a,b)/(norm(a)*norm(b)||1);
export const profile=ids=>TAGS.map((_,i)=>ids.reduce((s,id)=>s+(byId(id)?.vector[i]||0),0)/(ids.length||1));
export function validateSeeds(a,b){
 for(const ids of [a,b]) if(ids.length!==5||new Set(ids).size!==5||ids.some(id=>!byId(id))) throw new Error('Choose five different books for each reader.');
}
export function recommend(a,b,mode='least-misery'){
 validateSeeds(a,b);
 const pa=profile(a),pb=profile(b),selected=new Set([...a,...b]);
 return CATALOG.filter(x=>!selected.has(x.id)).map(book=>{
  const fitA=cosine(pa,book.vector),fitB=cosine(pb,book.vector);
  return {book,fitA,fitB,score:mode==='average'?(fitA+fitB)/2:Math.min(fitA,fitB),reasons:{a:evidence(book,a),b:evidence(book,b)}};
 }).sort((a,b)=>b.score-a.score||a.book.id.localeCompare(b.book.id)).slice(0,5);
}
export function evidence(book,ids){
 const matches=ids.map(byId).map(seed=>({seed,tags:book.tags.filter(t=>seed.tags.includes(t)),similarity:cosine(book.vector,seed.vector)})).sort((a,b)=>b.similarity-a.similarity);
 const match=matches[0];
 return {seedId:match.seed.id,seedTitle:match.seed.title,tags:match.tags.slice(0,3),text:match.tags.length?`A shared thread with your pick, ${match.seed.title}: ${match.tags.slice(0,2).map(tag=>tag.toLowerCase()).join(' and ')}.`:'No shared themes with your five picks. See the other reader’s reason before deciding.',source:'Sample book themes.'};
}
export function topTags(ids){
 const p=profile(ids);return TAGS.map((tag,i)=>({tag,weight:p[i]})).filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,3).map(x=>x.tag);
}
// Deterministic orthogonal projection of the same 12-dimensional fixture vectors
// used in cosine ranking. Projection is approximate; no probability is implied.
export function project(v){
 const x=[-1.6,1.6,.12,.3,-.8,.8,.65,-1.1,.3,-.9,-.2,.5];
 const y=[.2,.25,1.1,-.8,-.65,-.55,.85,-.1,.65,-.2,1.05,-.8];
 return {x:dot(v,x)/(norm(v)||1),y:dot(v,y)/(norm(v)||1)};
}
export function sessionFromURL(){
 const q=new URLSearchParams(location.search);
 const clean=key=>[...new Set((q.get(key)||'').split(',').filter(byId))].slice(0,5);
 return {a:clean('a'),b:clean('b'),mode:q.get('mode')==='average'?'average':'least-misery'};
}
export function seedQuery(a,b,mode='least-misery'){return new URLSearchParams({a:a.join(','),b:b.join(','),mode}).toString();}
