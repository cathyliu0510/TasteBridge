import {CATALOG,DEMO,byId,recommend,sessionFromURL,seedQuery} from './shared/engine.mjs?v=20261008.1';
import {$,$$,escape,brand,svg,bookTile,resultHTML,bindDialog,toast,motionPreference,setMotion} from './shared/ui.mjs?v=20261008.1';
import {TasteMap} from './shared/map.mjs?v=20261008.1';
import {installBridge} from './shared/bridge.mjs?v=20261008.1';
import {memoryRiver,journeyFrame} from './narrative.mjs?v=20261008.1';
import {TimeSpace} from './time-space.mjs?v=20261008.1';

const embedded=window.parent!==window;
document.documentElement.dataset.embedded=String(embedded);
const input=sessionFromURL();
const state={...input,stage:'opening',reader:'a',query:'',filter:'all',results:[],selected:null,votes:{},joint:null,deferred:false,newMemory:null,reduced:motionPreference(),optionsOpen:false};
const space=new TimeSpace(document.getElementById('time-space'));
let resultMap,lastScene,cleanupJourney=null;
const readerNumber=reader=>reader==='a'?'1':'2';
const readerLabel=reader=>`Reader ${readerNumber(reader)}`;
const ready=()=>state.a.length===5&&state.b.length===5;
const bothWilling=id=>state.votes[id]?.a==='yes'&&state.votes[id]?.b==='yes';
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
if(ready()){state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;state.stage='results';}
setMotion(state.reduced);

function header(){return `<header class="film-header"><button id="home" class="${embedded?'home-control':'brand'}" aria-label="TasteBridge home. Keep current favorites">${embedded?'Home':brand}</button><div class="film-tools"><a class="project-link" href="/project/">Project</a><button id="motion" class="motion-control" aria-pressed="${state.reduced}">${svg('moon')}${state.reduced?'Reduced motion':'Reduce motion'}</button>${embedded?'':`<a id="other-version" href="../a/?v=20261008.1&${seedQuery(state.a,state.b,state.mode)}">Version A</a>`}</div></header>${embedded?'':'<span class="prototype-banner">Frontend demo · Sample books</span>'}`;}
function render(){
 cleanupJourney?.();cleanupJourney=null;
 document.body.dataset.scene=state.stage;document.body.dataset.reader=state.reader;
 $('#app').innerHTML=header()+(state.stage==='opening'?openingHTML():state.stage==='select'?selectHTML():state.stage==='reveal'?revealHTML():resultsHTML())+`<dialog class="detail-dialog film-dialog" id="detail-dialog" aria-label="Book details and shared choice"><button class="close-dialog" aria-label="Close book details">${svg('close')}</button><div id="detail-body"></div></dialog>`;
 const sceneKey=state.stage==='select'?`select:${state.reader}`:state.stage;
 if(sceneKey!==lastScene&&state.stage!=='reveal')$('main').classList.add('is-entering');lastScene=sceneKey;
 $('main h1')?.setAttribute('tabindex','-1');
 $$('a.project-link').forEach(link=>link.addEventListener('click',()=>{link.href=`/project/?${seedQuery(state.a,state.b,state.mode)}`;}));
 $('#home').onclick=()=>{state.stage='opening';render();window.scrollTo({top:0,behavior:'instant'});focusHeading();};
 $('#motion').onclick=()=>{
  state.reduced=!state.reduced;setMotion(state.reduced);
  $('#motion').setAttribute('aria-pressed',String(state.reduced));$('#motion').innerHTML=svg('moon')+(state.reduced?'Reduced motion':'Reduce motion');
  const hit=$('#portal-interaction');if(hit){hit.disabled=state.reduced;hit.querySelector('.portal-hint').textContent=state.reduced?'Motion paused':'Drag to explore';}
  if(state.stage==='reveal'&&state.reduced)finishReveal();else space.setScene(state.stage,{a:state.a,b:state.b,reduced:state.reduced});
 };
 bindDialog($('#detail-dialog'));$('.close-dialog').onclick=()=>$('#detail-dialog').close();
 if(state.stage==='opening'){$('#begin').onclick=()=>goTo('select');$('#demo')?.addEventListener('click',loadDemo);bindPortal();}
 if(state.stage==='select')bindSelect();
 if(state.stage==='results')bindResults();
 space.setScene(state.stage,{a:state.a,b:state.b,reduced:state.reduced});
 if(state.stage==='reveal')bindJourney();
}
function focusHeading(){$('main h1')?.focus({preventScroll:true});}
function clearDecision(){state.votes={};state.joint=null;state.deferred=false;}
function clearToast(){clearTimeout(toast.timer);$('#toast')?.classList.remove('show');}
function bindPortal(){
 const hit=$('#portal-interaction');hit.disabled=state.reduced;let origin=null,moved=false,view=0;
 hit.onpointerdown=e=>{origin={x:e.clientX,y:e.clientY};moved=false;hit.setPointerCapture(e.pointerId);};
 hit.onpointermove=e=>{if(!origin)return;const dx=(e.clientX-origin.x)/Math.max(innerWidth*.35,1),dy=(e.clientY-origin.y)/Math.max(innerHeight*.4,1);if(Math.abs(dx)+Math.abs(dy)>.02)moved=true;view=Math.max(-1,Math.min(1,dx));space.explore(view,dy);};
 hit.onpointerup=()=>origin=null;hit.onpointercancel=()=>origin=null;
 hit.onclick=e=>{if(moved&&e.detail>0){moved=false;return;}view=view>.2?-.45:.45;space.explore(view,.12);};
 hit.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();view=Math.max(-1,Math.min(1,view+(e.key==='ArrowLeft'?-.2:.2)));space.explore(view);}};
}
function memoryLedger(ids,reader){return Array.from({length:5},(_,i)=>{
 const book=ids[i]?byId(ids[i]):null;
 return book?`<button class="memory-entry filled" data-remove="${book.id}" aria-label="Remove ${escape(book.title)} from ${readerLabel(reader)}"><span class="memory-order">${i+1}</span><span class="ledger-jacket mini-jacket" aria-hidden="true">${bookTile(book,{compact:true})}</span><span class="memory-title">${escape(book.title)}<small>${escape(book.author)}</small></span><span class="memory-remove" aria-hidden="true">×</span></button>`:`<div class="memory-entry vacant"><span class="memory-order">${i+1}</span><span>Add a favorite</span><span class="memory-remove" aria-hidden="true">+</span></div>`;
 }).join('');}
function openingHTML(){return `<main class="scene opening"><button id="portal-interaction" class="portal-interaction" aria-label="Explore the aperture. Drag or use the Left and Right arrow keys"><span class="portal-hint">${state.reduced?'Motion paused':'Drag to explore'}</span></button><div class="opening-content"><h1>Find your next<br><em>read together.</em></h1><p class="subline">Choose five favorites each.<br>Explore five books to read together.</p><div class="opening-actions"><button id="begin" class="film-primary">Choose favorites${arrow}</button>${embedded?'':`<button id="demo" class="film-secondary sample-button">Try sample books<span aria-hidden="true">↗</span></button>`}</div>${state.a.length+state.b.length?'<p class="opening-promise">Your favorites are still here.</p>':''}</div></main>`;}
function selectHTML(){const r=state.reader;return `<main class="scene select-scene"><section class="chapter-head"><div><p class="current-reader">${readerLabel(r)}</p><h1>Choose 5 favorites.</h1><p>Select books you’ve read and enjoyed.</p></div></section><div class="selection-layout"><section class="film-catalogue" aria-label="Sample books"><label class="search-field">${svg('search')}<span class="sr-only">Search book titles or authors</span><input id="search" type="search" autocomplete="off" placeholder="Search titles or authors" value="${escape(state.query)}"></label><div class="filter-list" aria-label="Filter books">${[['all','All'],['fantasy','Fantasy'],['mystery','Mystery'],['bridge','Mixed']].map(([id,name])=>`<button data-filter="${id}" class="${state.filter===id?'active':''}" aria-pressed="${state.filter===id}">${name}</button>`).join('')}</div><div id="book-grid" class="book-grid"></div></section><aside class="reading-world reader-${r}"><div class="reader-passport" aria-label="Reader selection progress">${['a','b'].map(reader=>`<button class="reader-${reader} ${reader===r?'active':''}" data-reader="${reader}" aria-pressed="${reader===r}"><span>${readerLabel(reader)}</span><small>${state[reader].length} of 5</small></button>`).join('')}</div><div class="world-meta"><strong>Your favorites</strong><span class="world-count" role="status">${state[r].length}<small> / 5</small></span><button id="switch-reader">${readerLabel(r==='a'?'b':'a')}${arrow}</button></div><div id="world-map" class="world-map memory-world">${memoryRiver(state.a,state.b,r,state.newMemory)}</div><div class="seed-slots memory-ledger">${memoryLedger(state[r],r)}</div><div class="world-footer"><button class="film-primary" id="next-reader" ${state[r].length<5?'disabled':''}>${ready()?'Show 5 recommendations':`Continue to ${readerLabel(r==='a'?'b':'a')}`}${arrow}</button></div></aside></div></main>`;}
function renderBooks(){
 const books=CATALOG.filter(book=>(state.filter==='all'||book.kind===state.filter)&&`${book.title} ${book.author}`.toLowerCase().includes(state.query.toLowerCase().trim()));
 $('#book-grid').innerHTML=books.length?books.map(book=>{const selected=state[state.reader].includes(book.id);return `<button class="book-pick ${selected?'is-picked':''}" data-book="${book.id}" aria-pressed="${selected}" aria-label="${selected?'Remove':'Select'} ${escape(book.title)}, ${escape(book.author)}"><span class="catalogue-jacket mini-jacket" aria-hidden="true">${bookTile(book,{compact:true})}</span><span class="choice-title">${escape(book.title)}<small>${escape(book.author)}</small></span><span class="choice-add" aria-hidden="true">${selected?'✓':'+'}</span></button>`;}).join(''):`<div class="empty-message">${state.filter==='all'?'No matching sample books.':'No matches in this category.'}<button id="clear-search" class="quiet">Clear search and filters</button></div>`;
 $$('[data-book]').forEach(btn=>btn.onclick=()=>toggleBook(btn.dataset.book));
 $('#clear-search')?.addEventListener('click',()=>{state.query='';state.filter='all';render();$('#search').focus();});
}
function bindSelect(){
 renderBooks();$('#search').oninput=e=>{state.query=e.target.value;renderBooks();};
 const switchReader=reader=>{state.reader=reader;state.query='';state.filter='all';state.newMemory=null;render();focusHeading();};
 $('#switch-reader').onclick=()=>switchReader(state.reader==='a'?'b':'a');
 $$('[data-reader]').forEach(btn=>btn.onclick=()=>switchReader(btn.dataset.reader));
 $$('[data-filter]').forEach(btn=>btn.onclick=()=>{state.filter=btn.dataset.filter;$$('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===state.filter);b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter));});renderBooks();});
 $$('[data-remove]').forEach(btn=>btn.onclick=()=>{const index=state[state.reader].indexOf(btn.dataset.remove);state[state.reader]=state[state.reader].filter(x=>x!==btn.dataset.remove);clearDecision();state.newMemory=null;state.results=[];state.selected=null;render();const remaining=$$('[data-remove]');(remaining[Math.min(index,remaining.length-1)]||$('#search')).focus({preventScroll:true});});
 $('#next-reader').onclick=()=>{if(ready())beginReveal();else{switchReader(state.reader==='a'?'b':'a');window.scrollTo({top:0,behavior:'instant'});}};
 state.newMemory=null;
}
function toggleBook(id){
 const ids=state[state.reader],selected=ids.includes(id),scroll=$('#book-grid').scrollTop;
 if(selected)state[state.reader]=ids.filter(x=>x!==id);else if(ids.length>=5){toast('You have five favorites. Remove one to make a swap.');return;}else ids.push(id);
 clearDecision();state.newMemory=selected?null:{reader:state.reader,id};state.results=[];state.selected=null;render();$('#book-grid').scrollTop=scroll;$(`[data-book="${id}"]`)?.focus({preventScroll:true});
}
function goTo(stage){
 if(stage==='results'){if(!ready()){toast('Choose five favorites for each reader first.');return;}state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;}
 if(stage==='select'){state.reader=state.a.length===5&&state.b.length<5?'b':'a';state.query='';state.filter='all';state.newMemory=null;}
 state.stage=stage;render();window.scrollTo({top:0,behavior:'instant'});focusHeading();
}
function loadDemo(){state.a=[...DEMO.a];state.b=[...DEMO.b];clearDecision();beginReveal();}
function beginReveal(){
 clearToast();state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;
 if(state.reduced){finishReveal();return;}
 state.stage='reveal';window.scrollTo({top:0,behavior:'instant'});render();focusHeading();
}
function revealHTML(){return `<main class="scene journey-runway" id="journey-runway"><section class="journey-sticky" id="journey-cinema" aria-label="Scroll journey from favorites to recommendations"><div class="journey-top"><h1>From your favorites<br><em>to your next read.</em></h1><button class="skip-reveal" id="skip-reveal">Skip to results${arrow}</button></div><div class="journey-seeds">${['a','b'].map(r=>`<div class="journey-reader reader-${r}"><strong>${readerLabel(r)}’s favorites</strong>${state[r].map((id,i)=>`<div class="journey-book-plane" data-plane-reader="${r}" data-plane-index="${i}" data-book-id="${id}"><span class="plane-jacket mini-jacket" aria-hidden="true">${bookTile(byId(id),{compact:true})}</span><span class="plane-title">${escape(byId(id).title)}</span></div>`).join('')}</div>`).join('')}</div><section class="journey-picks" aria-label="Five recommendations"><p>Five books to explore together.</p><ol>${state.results.map((result,i)=>`<li><span class="pick-number">${i+1}</span><span class="pick-jacket mini-jacket" aria-hidden="true">${bookTile(result.book,{compact:true})}</span><strong>${escape(result.book.title)}</strong></li>`).join('')}</ol><button id="journey-results" class="film-primary" disabled>Show 5 recommendations${arrow}</button></section><div class="journey-footer"><span id="journey-cue">Scroll to explore${arrow}</span><div class="journey-track" aria-hidden="true"><i></i></div></div></section></main>`;}
function bindJourney(){
 const runway=$('#journey-runway'),cinema=$('#journey-cinema');let frame=0;
 $('#skip-reveal').onclick=finishReveal;$('#journey-results').onclick=finishReveal;
 const update=()=>{
  frame=0;if(state.stage!=='reveal'||document.hidden||state.reduced||$('#detail-dialog')?.open)return;
  const headerHeight=$('.film-header').offsetHeight,top=runway.getBoundingClientRect().top+window.scrollY-headerHeight;
  const distance=Math.max(1,runway.offsetHeight-cinema.offsetHeight),motion=journeyFrame((window.scrollY-top)/distance);
  cinema.dataset.progress=motion.progress.toFixed(3);cinema.style.setProperty('--journey-progress',String(motion.progress));
  cinema.style.setProperty('--seed-opacity',String(motion.seeds));cinema.style.setProperty('--pick-opacity',String(motion.picks));
  const seedLayer=$('.journey-seeds');seedLayer.style.visibility=motion.seeds>.01?'visible':'hidden';seedLayer.setAttribute('aria-hidden',String(motion.seeds<=.01));
  const picks=$('.journey-picks');picks.style.visibility=motion.picks>.01?'visible':'hidden';picks.setAttribute('aria-hidden',String(motion.picks<=.01));
  $$('[data-plane-index]').forEach(plane=>{const direction=plane.dataset.planeReader==='a'?-1:1,index=Number(plane.dataset.planeIndex),local=journeyFrame(Math.max(0,motion.progress-index*.018));plane.style.transform=`perspective(1000px) translate3d(${direction*local.travel*105}px,${-local.travel*(22+index*3)}px,${local.travel*280}px) rotateY(${direction*local.travel*16}deg)`;});
  picks.style.transform=`translateY(${(1-motion.picks)*28}px)`;
  $('#journey-results').disabled=motion.progress<.82;
  $('#journey-cue').innerHTML=motion.progress>=.82?'Scroll up to revisit favorites':'Scroll to explore'+arrow;
  space.setJourneyProgress(motion.progress);
 };
 const request=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(update);};
 window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});document.addEventListener('visibilitychange',request);
 cleanupJourney=()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',request);window.removeEventListener('resize',request);document.removeEventListener('visibilitychange',request);};
 request();
}
function finishReveal(){clearToast();state.stage='results';render();window.scrollTo({top:0,behavior:'instant'});focusHeading();}
function resultsHTML(){return `<main class="scene results-scene"><section class="results-head"><h1>Five books for both of you.</h1><button id="edit-picks" class="film-secondary">Edit favorites${arrow}</button></section><section class="cinema-stage" aria-label="Selected recommendation"><div id="scene-focus" class="scene-focus"></div></section><section class="bridge-strip" id="bridge-strip" aria-label="Five recommendations"></section><div class="result-actions"><button id="defer-choice" class="defer-choice">Decide later</button></div><section id="decision-pause" class="decision-pause" role="status" hidden></section><section id="reading-ending" class="reading-ending" aria-label="Your shared book" hidden></section><details id="more-options" class="more-options" ${state.optionsOpen?'open':''}><summary>Map and matching options</summary><div class="options-content"><label class="matching-label">Match method<select id="aggregation"><option value="least-misery" ${state.mode==='least-misery'?'selected':''}>Balance both readers</option><option value="average" ${state.mode==='average'?'selected':''}>Average preferences</option></select></label><div class="galaxy-observatory"><div id="galaxy-frame" class="galaxy-frame"></div><div class="map-legend"><span><i></i>Reader 1</span><span><i></i>Reader 2</span><span><i></i>Recommendations</span></div></div></div></details></main>`;}
function bindResults(){
 $('#edit-picks').onclick=()=>goTo('select');
 $('#more-options').ontoggle=e=>state.optionsOpen=e.currentTarget.open;
 $('#aggregation').onchange=e=>{state.mode=e.target.value;clearDecision();state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;renderResultsContent();};
 $('#defer-choice').onclick=()=>{state.joint=null;state.deferred=true;renderResultsContent();$('#defer-choice').focus({preventScroll:true});};
 resultMap=new TasteMap($('#galaxy-frame'),{dark:true,onSelect:id=>{if(state.results.some(r=>r.book.id===id)){state.selected=id;renderResultsContent();openDetail(id);}else toast(`Favorite: ${byId(id).title}`);}});
 renderResultsContent();
}
function renderResultsContent(){
 const selected=state.results.find(r=>r.book.id===state.selected)||state.results[0],index=state.results.findIndex(r=>r.book.id===selected.book.id),focusChanged=$('#scene-focus').dataset.bookId!==selected.book.id;
 $('#scene-focus').dataset.bookId=selected.book.id;$('#scene-focus').dataset.rank=String(index+1);$('#scene-focus').classList.toggle('focus-arriving',focusChanged);
 $('#scene-focus').innerHTML=`<div class="featured-jacket" aria-hidden="true">${bookTile(selected.book)}</div><div class="editorial-copy"><div class="spread-heading"><span class="eyebrow">Recommendation ${index+1} of 5</span><h2>${escape(selected.book.title)}</h2><p class="featured-author">${escape(selected.book.author)}</p></div><div class="focus-traces">${['a','b'].map(r=>`<div class="focus-reason reader-${r}"><strong class="trace-reader">${readerLabel(r)}</strong><p>${escape(selected.reasons[r].text)}</p></div>`).join('')}</div><div class="recommendation-action"><button id="focus-detail" class="film-primary">Read reasons and decide${arrow}</button>${state.joint===selected.book.id?'<p class="shared-choice">Your shared choice</p>':bothWilling(selected.book.id)?'<p class="shared-choice">Both interested. Ready to confirm.</p>':''}</div></div>`;
 $('#focus-detail').onclick=()=>openDetail(selected.book.id);
 $('#bridge-strip').innerHTML=state.results.map((r,i)=>`<button class="bridge-pick ${r.book.id===state.selected?'selected':''}" data-result="${r.book.id}" aria-label="Recommendation ${i+1}: ${escape(r.book.title)}. Read reasons for both readers" aria-pressed="${r.book.id===state.selected}"><span class="bridge-number">${i+1}</span><span class="candidate-jacket mini-jacket" aria-hidden="true">${bookTile(r.book,{compact:true})}</span><span class="bridge-text"><strong>${escape(r.book.title)}</strong><small>${escape(r.book.author)}</small>${state.joint===r.book.id?'<span class="bridge-status">Chosen together</span>':bothWilling(r.book.id)?'<span class="bridge-status">Both interested</span>':''}</span></button>`).join('');
 $$('[data-result]').forEach(btn=>btn.onclick=()=>{state.selected=btn.dataset.result;renderResultsContent();openDetail(state.selected);});
 resultMap.update(state.a,state.b,state.results,state.selected);renderEnding();$('#other-version')?.setAttribute('href',`../a/?v=20261008.1&${seedQuery(state.a,state.b,state.mode)}`);
}
function decisionControls(id){return `<section class="joint-decision">${state.joint===id?'<h3>Your shared choice.</h3><button id="joint-action" data-joint="withdraw" class="film-secondary">Withdraw choice</button>':`<h3>Choose it together?</h3><p>${bothWilling(id)?'Both interested. Confirm when you’re ready.':'Both readers need to be interested before confirming.'}</p><button id="joint-action" data-joint="choose" class="film-primary" ${bothWilling(id)?'':'disabled'}>Choose this book</button>`}<button class="detail-continue" id="continue-exploring">Keep exploring</button></section>`;}
function renderDetail(id){
 const index=state.results.findIndex(r=>r.book.id===id),votes=state.votes[id]||{};
 $('#detail-body').innerHTML=resultHTML(state.results[index],index,votes)+decisionControls(id);
 $$('.vote-row').forEach((row,i)=>{const reader=i===0?'a':'b';if(row.querySelector(`[data-vote="${reader}:unsure"]`))return;const button=document.createElement('button');button.dataset.vote=`${reader}:unsure`;button.setAttribute('aria-pressed',String(votes[reader]==='unsure'));button.classList.toggle('chosen',votes[reader]==='unsure');button.textContent='Not sure';row.append(button);});
 $('.vote-state').textContent=state.joint===id?'Chosen together. You can still change your mind.':bothWilling(id)?'Both interested. Confirm to choose this book.':votes.a==='no'||votes.b==='no'?'Keep exploring the other books.':votes.a==='unsure'||votes.b==='unsure'?'No rush. Read the reasons or explore another book.':'Share your interest, then decide together.';
 bindVotes(id);$('#continue-exploring').onclick=()=>$('#detail-dialog').close();
 $('#joint-action').onclick=()=>{if(state.joint===id)state.joint=null;else if(bothWilling(id)){state.joint=id;state.deferred=false;}renderResultsContent();renderDetail(id);$('#joint-action').focus({preventScroll:true});};
}
function renderEnding(){
 const pause=$('#decision-pause');pause.hidden=!state.deferred;pause.innerHTML=state.deferred?'<div><strong>You can decide later.</strong><p>Your favorites and interests are still here.</p></div><button id="resume-exploring" class="film-secondary">Keep exploring</button>':'';
 $('#resume-exploring')?.addEventListener('click',()=>{state.deferred=false;renderEnding();$(`[data-result="${state.selected}"]`)?.focus({preventScroll:true});});
 const ending=$('#reading-ending'),chosen=state.results.find(r=>r.book.id===state.joint);ending.hidden=!chosen;if(!chosen){ending.innerHTML='';return;}
 ending.innerHTML=`<div><h2>Your next read, together.</h2><p class="ending-book">${escape(chosen.book.title)}<span>${escape(chosen.book.author)}</span></p></div><div class="ending-actions"><button id="ending-detail" class="film-primary">Read reasons</button><button id="withdraw-choice" class="film-secondary">Withdraw choice</button></div>`;
 $('#ending-detail').onclick=()=>{state.selected=chosen.book.id;renderResultsContent();openDetail(chosen.book.id);};
 $('#withdraw-choice').onclick=()=>{const id=state.joint;state.joint=null;renderResultsContent();$(`[data-result="${id}"]`)?.focus({preventScroll:true});};
}
function openDetail(id){$('#detail-dialog').dataset.bookId=id;renderDetail(id);$('#detail-dialog').showModal();}
function bindVotes(id){$$('[data-vote]').forEach(btn=>btn.onclick=()=>{const [reader,vote]=btn.dataset.vote.split(':');state.votes[id]??={};state.votes[id][reader]=vote;state.deferred=false;if(state.joint===id&&!bothWilling(id))state.joint=null;renderDetail(id);renderResultsContent();$(`[data-vote="${reader}:${vote}"]`)?.focus({preventScroll:true});});}
installBridge({
 read:()=>({a:[...state.a],b:[...state.b],mode:state.mode,stage:state.stage,fixture:'manual-tags-v1',recommendations:state.results.map(r=>r.book.id)}),
 apply:data=>{state.a=data.a;state.b=data.b;state.mode=data.mode;clearDecision();state.optionsOpen=false;state.newMemory=null;state.query='';state.filter='all';state.reader='a';if(ready()){beginReveal();return;}state.results=[];state.selected=null;state.stage='select';render();window.scrollTo({top:0,behavior:'instant'});},
 find:()=>goTo('results')
});
render();
