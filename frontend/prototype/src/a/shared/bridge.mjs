import {byId} from './engine.mjs?v=20261008.2';
function validateSession(input){
 if(!input||!Array.isArray(input.a)||!Array.isArray(input.b))throw new Error('Provide a list of favorites for both readers.');
 for(const ids of [input.a,input.b])if(ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!byId(id)))throw new Error('Each reader can choose up to five different sample books.');
 if(!['least-misery','average'].includes(input.mode||'least-misery'))throw new Error('Unknown ranking method.');
 return {a:[...input.a],b:[...input.b],mode:input.mode||'least-misery'};
}
export function installBridge(controller){
 // The comparison shell can copy only seeds and aggregation, after an explicit
 // user action. Votes and interaction records are never shared between versions.
 const read=()=>controller.read();
 document.addEventListener('click',e=>{
  if(window.parent===window)return;
  const anchor=e.target.closest('a[href]');
  if(!anchor)return;
  const url=new URL(anchor.href,location.href);
  const current=location.pathname.match(/\/(a|b)\//)?.[1];
  const target=url.pathname.match(/\/(a|b)\//)?.[1];
  if(url.origin===location.origin&&current&&target&&current!==target){e.preventDefault();window.parent.postMessage({type:'tastebridge:switch',version:target,session:read()},location.origin);}
 });
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==window.parent||!e.data)return;
  if(e.data.type==='tastebridge:read')e.source.postMessage({type:'tastebridge:session',requestId:e.data.requestId,session:read()},location.origin);
  if(e.data.type==='tastebridge:apply'){
   try{controller.apply(validateSession(e.data.session));e.source.postMessage({type:'tastebridge:applied',requestId:e.data.requestId},location.origin);}
   catch(error){e.source.postMessage({type:'tastebridge:error',message:error.message},location.origin);}
  }
 });
 const context=document.modelContext;
 if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const schema={type:'object',properties:{a:{type:'array',items:{type:'string'},maxItems:5,uniqueItems:true},b:{type:'array',items:{type:'string'},maxItems:5,uniqueItems:true},mode:{type:'string',enum:['least-misery','average']}},required:['a','b'],additionalProperties:false};
 const tools=[
  {name:'read_tastebridge_session',title:'Read this book selection',description:'Read the current favorites, ranking method and sample recommendations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>read()},
  {name:'set_tastebridge_favorites',title:'Set both readers’ favorites',description:'Update up to five favorites per reader and reset previous choices.',inputSchema:schema,annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{controller.apply(validateSession(input));return read();}},
  {name:'find_tastebridge_books',title:'Show five recommendations',description:'Show five sample recommendations and a reason for each reader after both choose five favorites.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{const s=read();if(s.a.length!==5||s.b.length!==5)throw new Error('Choose five books for each reader first.');controller.find();return read();}}
 ];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
