import {TasteBridgeClient} from '../api/client.mjs';
import {cacheApiBooks,byId} from './shared/catalog.mjs';

// A superseded response must not overwrite a newer search or favorite list,
// even if the transport ignores cancellation and returns successfully.
export class LatestRequests{
 constructor(){this.lanes=new Map();}
 cancel(lane){this.lanes.get(lane)?.abort();this.lanes.delete(lane);}
 async run(lane,execute){
  this.cancel(lane);const controller=new AbortController();this.lanes.set(lane,controller);
  try{
   const value=await execute(controller.signal);
   if(controller.signal.aborted||this.lanes.get(lane)!==controller)throw new DOMException('Superseded','AbortError');
   return value;
  }finally{if(this.lanes.get(lane)===controller)this.lanes.delete(lane);}
 }
}

export const API_SAMPLE={a:['w_1001','w_1002','w_1003','w_1004','w_1005'],b:['w_2001','w_2002','w_2003','w_2004','w_2005']};
export class ApiDesk{
 constructor(baseUrl,{client}={}){this.client=client||new TasteBridgeClient({baseUrl});this.requests=new LatestRequests();}
 health(){return this.requests.run('health',signal=>this.client.health({signal}));}
 async search(query){
  const books=await this.requests.run('search',signal=>this.client.searchBooks(query,{limit:25,signal}));
  return cacheApiBooks(books);
 }
 async book(id,options){
  if(byId(id)?.detailsLoaded)return byId(id);
  const book=await this.client.book(id,options);return cacheApiBooks([book],{full:true})[0];
 }
 async favorites(a,b){
  const books=await this.requests.run('favorites',signal=>Promise.all([...new Set([...a,...b])].map(id=>this.book(id,{signal}))));
  return books;
 }
 async recommend(a,b,mode){
  const reply=await this.requests.run('recommend',signal=>this.client.recommend(a,b,mode,{signal}));
  const books=cacheApiBooks(reply.results.map(result=>result.book),{full:true});
  return {...reply,results:reply.results.map((result,index)=>({...result,book:books[index]}))};
 }
 feedback(action){return this.client.feedback(action);}
}
