import {CATALOG,DEMO,byId,recommend,sessionFromURL,seedQuery} from './shared/engine.mjs?v=20261008.1';
import {$,$$,escape,brand,svg,bookTile,bindDialog,toast,makeRecorder} from './shared/ui.mjs?v=20261008.1';
import {DeskGalaxy} from './desk-galaxy.mjs?v=20261008.1';
import {installBridge} from './shared/bridge.mjs?v=20261008.1';
import {VOTE_OPTIONS,voteLabel,bothWilling,clearDecision,voteFor,confirmChoice,deferChoice} from './desk-decision.mjs?v=20261008.1';
import {readingShelf,readerName,catalogueSelection,readerEvidenceHTML} from './desk-presentation.mjs?v=20261008.1';
import {themeFavorites,favoriteReferences,shortlistText,copyShortlistText} from './desk-interactions.mjs?v=20261008.1';

document.documentElement.dataset.embedded=String(window.parent!==window);
const input=sessionFromURL();
const state={...input,reader:'a',stage:'select',query:'',filter:'all',mode:input.mode,results:[],selected:null,votes:{},choice:null,deferred:false,undo:null,handoff:'',exploration:null};
const recorder=makeRecorder('reading-desk');
const seenReveals=new Set();
const compactViewport=matchMedia('(max-width: 760px)');
let shelvesOpen=!compactViewport.matches;
let resultMap,pageObserver,detailObserver,lastDetailTrigger,explorerTrigger;
let detailMode='recommendation';
compactViewport.addEventListener('change',event=>{shelvesOpen=!event.matches;const shelves=$('#selected-shelves');if(shelves)shelves.open=shelvesOpen;});
if(state.a.length===5&&state.b.length===5){state.stage='results';state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;}

function header(){return `<header class="site-header"><a class="brand" href="./?v=20261008.1" aria-label="TasteBridge home">${brand}</a><nav class="site-nav" aria-label="Main navigation"><button id="nav-select" class="${state.stage==='select'?'active':''}">Pick books</button><button id="nav-results" class="${state.stage==='results'?'active':''}">Recommendations</button><a class="project-link" href="/project/">Project</a></nav><a id="other-version" class="other-version" href="../b/?v=20261008.1&${seedQuery(state.a,state.b,state.mode)}">View version B <span aria-hidden="true">↗</span></a></header>`;}
function footer(){return `<footer class="footer-line"><span>Frontend prototype · ${CATALOG.length} sample books</span><a class="project-link" href="/project/">About the project ↗</a></footer>`;}
function revealItems(nodes,context,root=null){
 if(typeof IntersectionObserver!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList.add('is-revealed');seenReveals.add(entry.target.dataset.revealKey);observer.unobserve(entry.target);}},{root,threshold:.08,rootMargin:'0px 0px 24px 0px'});
 nodes.forEach((node,index)=>{const key=`${context}:${node.dataset.book||node.dataset.result||index}`;if(seenReveals.has(key))return;node.dataset.revealKey=key;node.classList.add('reveal-item');node.style.setProperty('--reveal-delay',`${index%4*35}ms`);observer.observe(node);});
 return observer;
}
function render(){
 pageObserver?.disconnect();detailObserver?.disconnect();resultMap?.destroy();resultMap=null;
 $('#app').innerHTML=header()+`<main class="desk-main">${state.stage==='select'?selectHTML():resultsHTML()}${footer()}</main><dialog id="detail-dialog" class="detail-dialog" aria-labelledby="detail-title"><button class="close-dialog" aria-label="Close book details">${svg('close')}</button><div id="detail-body"></div></dialog>`;
 $$('a.project-link').forEach(link=>link.addEventListener('click',()=>{link.href=`/project/?${seedQuery(state.a,state.b,state.mode)}`;}));
 $('#nav-select').onclick=editPicks;
 $('#nav-results').onclick=()=>{if(state.a.length!==5||state.b.length!==5){toast('Each reader needs 5 books.');return;}showResults();};
 const dialog=$('#detail-dialog');bindDialog(dialog);$('.close-dialog').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{const trigger=lastDetailTrigger;state.exploration=null;requestAnimationFrame(()=>restoreDetailFocus(trigger));});
 dialog.addEventListener('cancel',event=>{if(detailMode==='recommendation'&&state.exploration){event.preventDefault();closeExplorer();}});
 dialog.addEventListener('keydown',event=>{if(detailMode!=='recommendation'||state.exploration||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,[contenteditable]'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigateCandidate(event.key==='ArrowLeft'?-1:1);}});
 if(state.stage==='select')bindSelect();else bindResults();
}
function titleFocus(){$('#page-title')?.focus({preventScroll:true});}
function editPicks(){state.stage='select';state.query='';state.filter='all';state.exploration=null;render();titleFocus();}
function selectionStatus(){if(state.a.length===5&&state.b.length===5)return 'Both readers are ready.';const count=state[state.reader].length;return count===5?`${readerName(state.reader)} is ready.`:`Choose ${5-count} more ${count===4?'book':'books'}.`;}
function continueLabel(){if(state.a.length===5&&state.b.length===5)return 'Show 5 recommendations';if(state[state.reader].length<5)return 'Pick 5 favorites';return `Continue to ${readerName(state.reader==='a'?'b':'a')}`;}
function readerShelfHTML(reader){return `<section class="reader-summary reader-${reader} ${state.reader===reader?'active':''}"><div class="summary-head"><strong>${readerName(reader)} <span>${state[reader].length}/5</span></strong><button data-reader="${reader}" aria-label="Edit ${readerName(reader)} favorites">${state.reader===reader?'Editing':'Edit'}</button></div><div class="seed-slots">${readingShelf(state[reader],reader)}</div><div class="shelf-actions"><button class="quiet" data-clear-reader="${reader}" ${state[reader].length?'':'disabled'}>Clear ${readerName(reader)}</button></div></section>`;}
function selectHTML(){return `<section class="intro"><div><h1 id="page-title" tabindex="-1">Find your next <em>read together.</em></h1><p>Five favorites each. Five books to read together.</p></div><button id="demo" class="sample-button">Try sample books <span aria-hidden="true">↗</span></button></section><div class="desk-workspace"><section class="catalogue reader-${state.reader}" aria-labelledby="pick-title"><div class="section-top"><h2 id="pick-title">Pick your favorites</h2><div class="reader-tabs" role="group" aria-label="Reader choosing books">${['a','b'].map(reader=>`<button class="reader-${reader} ${state.reader===reader?'active':''}" data-reader="${reader}" aria-pressed="${state.reader===reader}">${readerName(reader)} <span>${state[reader].length}/5</span></button>`).join('')}</div></div><p id="selection-status" class="selection-status" role="status">${selectionStatus()}</p><p id="handoff-note" class="handoff-note" role="status">${escape(state.handoff)}</p><label class="search-field">${svg('search')}<span class="sr-only">Search by book title or author</span><input id="search" type="search" placeholder="Search titles or authors" autocomplete="off" value="${escape(state.query)}"></label><div class="catalogue-toolbar"><div class="filter-list" role="group" aria-label="Book category">${[['all','All books'],['fantasy','Fantasy'],['mystery','Mystery'],['bridge','Both']].map(([id,name])=>`<button data-filter="${id}" class="${state.filter===id?'active':''}" aria-pressed="${state.filter===id}">${name}</button>`).join('')}</div><span id="catalogue-count" class="catalogue-count"></span></div><p id="catalogue-feedback" role="status"></p><div id="book-grid" class="book-grid"></div></section><aside class="pair-panel" aria-label="Selected favorites"><details id="selected-shelves" class="shelf-disclosure" ${shelvesOpen?'open':''}><summary><span>Your books</span><span class="shelf-counts">${shelfCountsHTML()}</span></summary><div class="shelf-content">${['a','b'].map(readerShelfHTML).join('')}<button id="undo-selection" class="quiet" ${state.undo?'':'hidden'}>Undo last change</button></div></details><button id="pair-next" class="pair-next" ${state[state.reader].length<5?'disabled':''}>${continueLabel()} <span aria-hidden="true">→</span></button></aside></div>`;}
function shelfCountsHTML(){return ['a','b'].map((reader,index)=>`<span aria-label="${readerName(reader)} ${state[reader].length} of 5 books"><i aria-hidden="true">${index+1}</i>${state[reader].length}/5</span>`).join('');}
function bookPickHTML(book){const view=catalogueSelection(book,state.a,state.b,state.reader);return `<button class="book-pick ${view.selected?'is-picked':''}" data-book="${book.id}" aria-label="${escape(view.ariaLabel)}" aria-pressed="${view.selected}">${bookTile(book,{selected:view.selected})}<span class="book-pick-note">${escape(view.label)}</span></button>`;}
function renderBooks(){
 pageObserver?.disconnect();
 const books=CATALOG.filter(book=>(state.filter==='all'||book.kind===state.filter)&&`${book.title} ${book.author}`.toLowerCase().includes(state.query.toLowerCase().trim()));
 $('#catalogue-count').textContent=`${books.length} books`;
 const category={fantasy:'Fantasy',mystery:'Mystery',bridge:'Fantasy / Mystery'}[state.filter],query=state.query.trim();
 $('#catalogue-feedback').textContent=query?`${books.length} ${books.length===1?'match':'matches'} for “${query}”${category?` in ${category}`:''}.`:category?`${books.length} ${category} books.`:'';
 $('#book-grid').innerHTML=books.length?books.map(bookPickHTML).join(''):`<div class="empty-message"><p>No books match this search and category.</p><button id="clear-search" class="secondary">Show all books</button></div>`;
 $$('[data-book]').forEach(button=>button.onclick=()=>toggleBook(button.dataset.book));
 $('#clear-search')?.addEventListener('click',()=>{state.query='';state.filter='all';$('#search').value='';syncFilters();renderBooks();$('#search').focus({preventScroll:true});});
 pageObserver=revealItems($$('[data-book]'),'catalogue');
}
function syncFilters(){$$('[data-filter]').forEach(button=>{button.classList.toggle('active',button.dataset.filter===state.filter);button.setAttribute('aria-pressed',String(button.dataset.filter===state.filter));});}
function syncCatalogueSelection(){
 $$('[data-book]').forEach(button=>{
  const book=byId(button.dataset.book),view=catalogueSelection(book,state.a,state.b,state.reader);
  button.classList.toggle('is-picked',view.selected);button.setAttribute('aria-pressed',String(view.selected));button.setAttribute('aria-label',view.ariaLabel);$('.book-pick-note',button).textContent=view.label;
  const check=$('.book-check',button);if(view.selected&&!check)$('.book-object',button).insertAdjacentHTML('beforeend',`<span class="book-check">${svg('check')}</span>`);else if(!view.selected)check?.remove();
 });
}
function syncSelectionChrome(){
 $('.catalogue').classList.toggle('reader-a',state.reader==='a');$('.catalogue').classList.toggle('reader-b',state.reader==='b');
 $$('[data-reader]').forEach(button=>{const reader=button.dataset.reader;if(button.closest('.reader-tabs')){button.innerHTML=`${readerName(reader)} <span>${state[reader].length}/5</span>`;button.classList.toggle('active',state.reader===reader);button.setAttribute('aria-pressed',String(state.reader===reader));}else button.textContent=state.reader===reader?'Editing':'Edit';});
 ['a','b'].forEach(reader=>{const summary=$(`.reader-summary.reader-${reader}`);summary.classList.toggle('active',state.reader===reader);$('.summary-head strong',summary).innerHTML=`${readerName(reader)} <span>${state[reader].length}/5</span>`;$('[data-clear-reader]',summary).disabled=state[reader].length===0;});
 $('.shelf-counts').innerHTML=shelfCountsHTML();$('#selection-status').textContent=selectionStatus();$('#handoff-note').textContent=state.handoff;
 $('#pair-next').disabled=state[state.reader].length<5;$('#pair-next').innerHTML=`${continueLabel()} <span aria-hidden="true">→</span>`;$('#undo-selection').hidden=!state.undo;
 $('#other-version').href=`../b/?v=20261008.1&${seedQuery(state.a,state.b,state.mode)}`;
}
function updateShelf(reader){const summary=$(`.reader-summary.reader-${reader}`);$('.seed-slots',summary).innerHTML=readingShelf(state[reader],reader);bindShelf(summary);}
function motionHook(node,name){if(!node)return;node.classList.remove('just-added','just-removed');node.classList.add(name);setTimeout(()=>{if(node.isConnected)node.classList.remove(name);},450);}
function switchReader(reader,{handoff=false}={}){
 if(state.reader===reader){$('#search').focus({preventScroll:true});return;}
 state.reader=reader;state.handoff=handoff?`${readerName(reader)}, your turn. The other reader’s books are kept.`:`Now editing ${readerName(reader)}.`;
 if(handoff){state.query='';state.filter='all';$('#search').value='';syncFilters();renderBooks();if(compactViewport.matches){shelvesOpen=false;$('#selected-shelves').open=false;}}
 syncSelectionChrome();syncCatalogueSelection();$('#search').focus({preventScroll:!handoff});recorder.record('switch_reader',{reader});
}
function bindShelf(container){
 $$('[data-remove]',container).forEach(button=>button.onclick=()=>{
  const reader=button.closest('.reader-summary').classList.contains('reader-a')?'a':'b',id=button.dataset.remove,index=state[reader].indexOf(id);
  changeFavorites(reader,state[reader].filter(bookId=>bookId!==id));motionHook($(`[data-book="${id}"]`),'just-removed');
  const remaining=$$(`.reader-summary.reader-${reader} [data-remove]`);(remaining[Math.min(index,remaining.length-1)]||$(`.reader-summary.reader-${reader} [data-reader]`))?.focus({preventScroll:true});recorder.record('remove_seed',{reader});
 });
 const clear=$('[data-clear-reader]',container);if(clear)clear.onclick=()=>{const reader=container.classList.contains('reader-a')?'a':'b';if(!state[reader].length)return;changeFavorites(reader,[]);toast(`${readerName(reader)} cleared. Undo is available.`);};
}
function bindSelect(){
 renderBooks();
 const shelves=$('#selected-shelves');shelves.addEventListener('toggle',()=>{if(shelves.isConnected)shelvesOpen=shelves.open;});
 $('#search').addEventListener('input',event=>{state.query=event.target.value;renderBooks();});
 $$('[data-reader]').forEach(button=>button.onclick=()=>switchReader(button.dataset.reader));
 $$('[data-filter]').forEach(button=>button.onclick=()=>{state.filter=button.dataset.filter;syncFilters();renderBooks();});
 $$('.reader-summary').forEach(bindShelf);
 $('#undo-selection').onclick=()=>{const change=state.undo;if(!change)return;state[change.reader]=[...change.before];state.undo=null;invalidateInput();updateShelf(change.reader);syncSelectionChrome();syncCatalogueSelection();$('#selected-shelves summary').focus({preventScroll:true});toast('Last selection change undone.');};
 $('#pair-next').onclick=()=>{if(state.a.length===5&&state.b.length===5)showResults();else switchReader(state.reader==='a'?'b':'a',{handoff:true});};
 $('#demo').onclick=()=>{state.a=[...DEMO.a];state.b=[...DEMO.b];state.undo=null;state.exploration=null;clearDecision(state);recorder.record('use_demo');showResults();};
}
function invalidateInput(){clearDecision(state);state.results=[];state.selected=null;state.exploration=null;}
function changeFavorites(reader,ids){state.undo={reader,before:[...state[reader]]};state[reader]=[...ids];state.handoff='';invalidateInput();updateShelf(reader);syncSelectionChrome();syncCatalogueSelection();}
function toggleBook(id){
 const ids=state[state.reader],wasSelected=ids.includes(id);
 if(!wasSelected&&ids.length>=5){toast('You picked 5 books. Remove one to choose another.');return;}
 changeFavorites(state.reader,wasSelected?ids.filter(bookId=>bookId!==id):[...ids,id]);
 motionHook($(`[data-book="${id}"]`),wasSelected?'just-removed':'just-added');
 if(!wasSelected)motionHook($(`.reader-summary.reader-${state.reader} [data-remove="${id}"]`),'just-added');
 recorder.record(wasSelected?'remove_seed':'add_seed',{reader:state.reader,count:state[state.reader].length});
}
function showResults(){state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;state.stage='results';state.query='';state.exploration=null;recorder.record('show_results',{aggregation:state.mode});render();window.scrollTo({top:0,behavior:'instant'});titleFocus();}
function resultsHTML(){return `<section class="result-top"><h1 id="page-title" tabindex="-1">Your 5 recommendations</h1><div class="result-actions"><button id="open-galaxy" class="secondary">${svg('map')}Taste galaxy</button><button id="copy-shortlist" class="secondary">Copy shortlist</button><button id="show-shortlist" class="quiet">Show shortlist text</button><button id="edit-picks" class="secondary">Change books</button></div></section><p id="copy-status" class="sr-only" role="status"></p><section id="copy-fallback" class="copy-fallback" hidden aria-label="Manual shortlist copy"><p id="copy-help">Select this text and copy it.</p><textarea id="shortlist-text" readonly rows="8" aria-label="Shortlist text to copy"></textarea><div><button id="select-copy-text" class="secondary">Select text</button><button id="close-copy-fallback" class="quiet">Close</button></div></section><div id="decision-panel"></div><section class="results-layout" aria-label="Five recommendations"><div class="mode-control"><label for="aggregation">Preference balance</label><select id="aggregation"><option value="least-misery" ${state.mode==='least-misery'?'selected':''}>Balance both readers</option><option value="average" ${state.mode==='average'?'selected':''}>Average both readers</option></select></div><div id="result-list" class="result-list"></div></section><details id="taste-map-panel" class="taste-map-disclosure"><summary>Taste galaxy</summary><div class="galaxy-panel"><div class="map-legend"><span><i></i>Reader 1</span><span><i></i>Reader 2</span><span><i></i>Recommendations</span></div><div id="large-map" class="large-map"></div><div id="map-selected" class="map-selected"></div></div></details>`;}
function bindResults(){
 $('#edit-picks').onclick=editPicks;
 $('#aggregation').onchange=event=>{state.mode=event.target.value;clearDecision(state);state.exploration=null;state.results=recommend(state.a,state.b,state.mode);state.selected=state.results[0].book.id;renderResultsContent();recorder.record('change_aggregation',{aggregation:state.mode});toast('Recommendations updated. Share your interest again.');};
 resultMap=new DeskGalaxy($('#large-map'),{onSelect:id=>openDetail(id,{kind:'map',id}),onFavorite:id=>openFavorite(id,{kind:'favorite-map',id})});
 $('#open-galaxy').onclick=()=>{const panel=$('#taste-map-panel');panel.open=true;resultMap.update(state.a,state.b,state.results,state.selected);panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});$('summary',panel).focus({preventScroll:true});};
 $('#copy-shortlist').onclick=async()=>{
  const status=$('#copy-status'),text=shortlistText(state.results,state.choice),copied=await copyShortlistText(text);
  if(!status.isConnected||$('#copy-status')!==status||state.stage!=='results')return;
  if(shortlistText(state.results,state.choice)!==text){status.textContent='The shortlist changed. Copy it again.';toast('The shortlist changed. Please copy again.');return;}
  status.textContent=copied?'Shortlist copied.':'Clipboard unavailable. Copy the text manually.';
  if(copied){toast('Shortlist copied.');if(!$('#copy-fallback').hidden)$('#copy-help').textContent='This shortlist is also available to copy manually.';}
  else showShortlistText(true);
  recorder.record('copy_shortlist',{outcome:copied?'copied':'manual'});
 };
 $('#show-shortlist').onclick=()=>showShortlistText(false);
 $('#select-copy-text').onclick=()=>{$('#shortlist-text').focus();$('#shortlist-text').select();};
 $('#close-copy-fallback').onclick=()=>{$('#copy-fallback').hidden=true;$('#copy-shortlist').focus({preventScroll:true});};
 $('#shortlist-text').onkeydown=event=>{if(event.key==='Escape'){$('#copy-fallback').hidden=true;$('#copy-shortlist').focus({preventScroll:true});}};
 renderResultsContent();
}
function showShortlistText(failed=false){
 const text=shortlistText(state.results,state.choice);$('#copy-fallback').hidden=false;$('#copy-help').textContent=failed?'Clipboard unavailable. Select this text and copy it.':'Select this text and use your copy shortcut.';$('#shortlist-text').value=text;$('#shortlist-text').focus();$('#shortlist-text').select();
}
function decisionHTML(){
 const choice=state.results.find(result=>result.book.id===state.choice),count=state.results.filter(result=>bothWilling(state.votes[result.book.id])).length;
 if(choice)return `<section class="decision-strip confirmed" aria-labelledby="decision-heading"><div class="decision-copy"><h2 id="decision-heading" tabindex="-1">Your next read</h2><p><strong>${escape(choice.book.title)}</strong><span>${escape(choice.book.author)}</span></p></div><div class="decision-actions"><button id="review-choice" class="primary">View reasons</button><button id="revoke-choice" class="secondary">Undo choice</button></div></section>`;
 if(state.deferred)return `<section class="decision-strip deferred" aria-labelledby="decision-heading"><div class="decision-copy"><h2 id="decision-heading" tabindex="-1">No book chosen yet</h2><p>Your shortlist is still here.</p></div><button id="reopen-choice" class="secondary">Keep looking</button></section>`;
 return `<section class="decision-strip open" aria-labelledby="decision-heading"><div class="decision-copy"><h2 id="decision-heading" tabindex="-1">Choose one together</h2>${count?`<p>${count} ${count===1?'book you both want':'books you both want'} to read.</p>`:''}</div><button id="defer-choice" class="quiet">Decide later</button></section>`;
}
function bindDecision(){
 $('#review-choice')?.addEventListener('click',()=>openDetail(state.choice));
 $('#revoke-choice')?.addEventListener('click',()=>{recorder.record('revoke_choice',{rank:state.results.findIndex(result=>result.book.id===state.choice)+1});state.choice=null;renderResultsContent();$('#decision-heading').focus({preventScroll:true});toast('Choice undone. Your interests are kept.');});
 $('#defer-choice')?.addEventListener('click',()=>{deferChoice(state);renderResultsContent();$('#decision-heading').focus({preventScroll:true});recorder.record('defer_choice');});
 $('#reopen-choice')?.addEventListener('click',()=>{state.deferred=false;renderResultsContent();$(`.result-card[data-result="${state.selected}"]`,$('#result-list')).focus({preventScroll:true});});
}
function renderResultsContent(){
 pageObserver?.disconnect();$('#decision-panel').innerHTML=decisionHTML();bindDecision();
 $('#result-list').innerHTML=state.results.map((result,index)=>{const id=result.book.id,votes=state.votes[id]||{},chosen=state.choice===id;return `<button class="result-card ${index===0?'featured-result':''} ${state.selected===id?'selected':''} ${chosen?'joint-choice':''}" data-result="${id}" aria-label="View ${escape(result.book.title)} and both readers' reasons${chosen?'; chosen together':''}"><span class="rank-number" aria-hidden="true">${index+1}</span>${bookTile(result.book)}<div class="result-info"><div class="result-title-line"><h2>${escape(result.book.title)}</h2><span class="detail-cue" aria-hidden="true">↗</span></div><p>${escape(result.book.author)}</p><div class="result-evidence-preview">${['a','b'].map(reader=>`<div class="result-reason-preview reader-${reader}"><span class="reason-preview-label">${readerName(reader)} · Your reference</span><strong>${escape(result.reasons[reader].seedTitle)}</strong><span class="reason-preview-tags">${result.reasons[reader].tags.slice(0,2).map(escape).join(' · ')||'No shared themes'}</span></div>`).join('')}</div><div class="card-vote-row">${['a','b'].map(reader=>`<span class="reader-${reader}">${readerName(reader)}: ${voteLabel(votes[reader])}</span>`).join('')}${chosen?'<strong class="card-outcome">Chosen together</strong>':bothWilling(votes)?'<span class="card-outcome">Both interested · Confirm to choose</span>':''}</div></div></button>`;}).join('');
 $$('.result-card[data-result]',$('#result-list')).forEach(button=>button.onclick=()=>openDetail(button.dataset.result));
 const result=state.results.find(item=>item.book.id===state.selected)||state.results[0];
 $('#map-selected').innerHTML=`<div>${escape(result.book.title)}</div><button id="map-detail" class="secondary">View reasons</button>`;
 $('#map-detail').onclick=()=>openDetail(result.book.id,{kind:'map-action',id:result.book.id});
 $$('a[href^="../b/"]').forEach(link=>link.href=`../b/?v=20261008.1&${seedQuery(state.a,state.b,state.mode)}`);
 resultMap.update(state.a,state.b,state.results,state.selected);pageObserver=revealItems($$('.result-card[data-result]',$('#result-list')),'recommendation');
 if(!$('#copy-fallback').hidden)$('#shortlist-text').value=shortlistText(state.results,state.choice);
}
function mapNode(id){const container=$('#large-map');return container?$(`.map-node[data-id="${id}"]`,container):null;}
function restoreDetailFocus(trigger){
 let target;if(trigger?.kind==='favorite-map'||trigger?.kind==='map')target=mapNode(trigger.id);else if(trigger?.kind==='map-action')target=$('#map-detail');else target=$(`.result-card[data-result="${trigger?.id||state.selected}"]`);
 (target||$('#open-galaxy')||$('#page-title'))?.focus({preventScroll:true});
}
function opinionNote(votes={}){if(bothWilling(votes))return 'Both interested. Confirm to choose it together.';if(votes.a==='no'||votes.b==='no')return 'Keep exploring the other books.';if(votes.a==='unsure'||votes.b==='unsure')return 'Not sure yet? You can come back to this one.';if(votes.a||votes.b)return 'Waiting for the other reader.';return 'Interest is optional. Confirm only when you both agree.';}
function detailHTML(result,index){
 const id=result.book.id,votes=state.votes[id]||{},chosen=state.choice===id,previous=state.results[(index+state.results.length-1)%state.results.length],next=state.results[(index+1)%state.results.length];
 return `<div class="detail-header"><span class="book-position">Book ${index+1} of 5</span><h2 id="detail-title" tabindex="-1">${escape(result.book.title)}</h2><p>${escape(result.book.author)} · ${result.book.year}</p></div><div class="reasons">${['a','b'].map(reader=>readerEvidenceHTML(result,reader,state[reader],state.exploration)).join('')}</div><section id="evidence-explorer" class="evidence-explorer" hidden></section><div class="votes-block"><h3>Would you read this?</h3><div class="desk-vote-columns">${['a','b'].map(reader=>`<section class="desk-vote-reader reader-${reader}" aria-label="${readerName(reader)} interest"><strong>${readerName(reader)}</strong><div class="desk-vote-options">${VOTE_OPTIONS.map(([value,label])=>`<button data-vote="${reader}:${value}" aria-label="${readerName(reader)}: ${label}" aria-pressed="${votes[reader]===value}" class="${votes[reader]===value?'chosen':''}">${label}</button>`).join('')}</div></section>`).join('')}</div><p id="opinion-note" class="vote-state" role="status">${chosen?'Chosen together. You can change your mind.':opinionNote(votes)}</p></div><div class="detail-choice-actions"><button id="confirm-choice" class="primary" ${!bothWilling(votes)||chosen?'disabled':''}>${chosen?'Chosen together':'Confirm together'}</button></div><nav class="detail-pagination" aria-label="Browse the five recommendations"><button id="prev-candidate" class="secondary" aria-label="Previous book: ${escape(previous.book.title)}">← Previous</button><span class="candidate-position">${index+1} / 5</span><button id="next-candidate" class="secondary" aria-label="Next book: ${escape(next.book.title)}">Next →</button></nav>`;
}
function refreshDetail(id,focus){
 detailObserver?.disconnect();detailMode='recommendation';const index=state.results.findIndex(result=>result.book.id===id),dialog=$('#detail-dialog');
 dialog.dataset.bookId=id;$('#detail-body').innerHTML=detailHTML(state.results[index],index);bindDetail(id);renderExplorer();if(focus)$(focus)?.focus({preventScroll:true});
 if(dialog.open)detailObserver=revealItems($$('.reason'),`reason-${id}`,dialog);
}
function openDetail(id,trigger={kind:'result',id}){
 if(!state.results.some(result=>result.book.id===id))return;
 const dialog=$('#detail-dialog');if(!dialog.open)lastDetailTrigger=trigger;
 state.selected=id;state.exploration=null;renderResultsContent();refreshDetail(id);recorder.record('open_explanation',{rank:state.results.findIndex(result=>result.book.id===id)+1});
 if(!dialog.open)dialog.showModal();$('#detail-title').focus({preventScroll:true});detailObserver=revealItems($$('.reason'),`reason-${id}`,dialog);
}
function navigateCandidate(direction){const index=state.results.findIndex(result=>result.book.id===state.selected),next=(index+direction+state.results.length)%state.results.length;state.selected=state.results[next].book.id;state.exploration=null;if(lastDetailTrigger&&['result','map','map-action'].includes(lastDetailTrigger.kind))lastDetailTrigger.id=state.selected;renderResultsContent();refreshDetail(state.selected,'#detail-title');recorder.record('open_explanation',{rank:next+1});}
function bindDetail(id){
 $$('[data-vote]').forEach(button=>button.onclick=()=>{const [reader,vote]=button.dataset.vote.split(':'),revoked=voteFor(state,id,reader,vote);recorder.record('vote',{rank:state.results.findIndex(result=>result.book.id===id)+1,reader,vote});refreshDetail(id,`[data-vote="${reader}:${vote}"]`);renderResultsContent();if(revoked)toast('Interest changed. The shared choice was undone.');});
 $('#confirm-choice').onclick=()=>{if(!confirmChoice(state,id))return;refreshDetail(id,'#detail-title');renderResultsContent();recorder.record('confirm_choice',{rank:state.results.findIndex(result=>result.book.id===id)+1});toast('Chosen together.');};
 $('#prev-candidate').onclick=()=>navigateCandidate(-1);$('#next-candidate').onclick=()=>navigateCandidate(1);bindEvidence();
}
function bindEvidence(){
 $$('[data-seed]',$('#detail-body')).forEach(button=>button.onclick=()=>{const previous=state.exploration,fromTheme=previous?.kind==='theme'&&button.closest('.theme-favorites')&&button.dataset.reader===previous.reader;explorerTrigger=fromTheme?{kind:'theme',reader:previous.reader,theme:previous.theme}:{kind:'seed',reader:button.dataset.reader,id:button.dataset.seed};state.exploration={kind:'seed',reader:button.dataset.reader,id:button.dataset.seed,parentTheme:fromTheme?previous.theme:null};renderExplorer();$('#explorer-title').focus();});
 $$('[data-theme]',$('#detail-body')).forEach(button=>button.onclick=()=>{const reader=button.dataset.reader,theme=button.dataset.theme;if(state.exploration?.kind==='theme'&&state.exploration.reader===reader&&state.exploration.theme===theme){closeExplorer();return;}explorerTrigger={kind:'theme',reader,theme};state.exploration={kind:'theme',reader,theme};renderExplorer();$('#explorer-title').focus();});
}
function renderExplorer(){
 const region=$('#evidence-explorer');if(!region)return;const exploration=state.exploration,result=state.results.find(item=>item.book.id===state.selected);
 $$('[data-theme]',$('#detail-body')).forEach(button=>button.setAttribute('aria-pressed',String(exploration?.kind==='theme'&&button.dataset.reader===exploration.reader&&button.dataset.theme===exploration.theme)));
 region.hidden=!exploration;if(!exploration){region.innerHTML='';return;}
 const reader=exploration.reader;
 if(exploration.kind==='theme'){
  const matches=themeFavorites(state[reader],exploration.theme);
  region.innerHTML=`<div class="theme-inspector"><h3 id="explorer-title" tabindex="-1">${escape(exploration.theme)}</h3><p>${matches.length} of ${readerName(reader)}’s five favorites share this sample theme with ${escape(result.book.title)}.</p><div class="theme-favorites">${matches.map(book=>`<button class="evidence-seed" data-seed="${book.id}" data-reader="${reader}">${escape(book.title)} <span aria-hidden="true">↗</span></button>`).join('')}</div><button id="close-explorer" class="quiet">Back to reasons</button></div>`;
 }else{
  const book=byId(exploration.id),shared=book.tags.filter(theme=>result.book.tags.includes(theme));
  region.innerHTML=`<div class="seed-inspector"><div class="favorite-cover" aria-hidden="true">${bookTile(book,{compact:true})}</div><div class="favorite-info"><p>${readerName(reader)}’s favorite</p><h3 id="explorer-title" tabindex="-1">${escape(book.title)}</h3><p>${escape(book.author)} · ${book.year}</p><p>${shared.length?`Shared sample themes with ${escape(result.book.title)}: ${shared.map(escape).join(' · ')}.`:'No shared sample themes with this recommendation.'}</p>${exploration.parentTheme?'<button id="back-to-theme" class="secondary">Back to shared theme</button>':''}<button id="close-explorer" class="quiet">Back to reasons</button></div></div>`;
 }
 $('#close-explorer').onclick=closeExplorer;
 $('#back-to-theme')?.addEventListener('click',()=>{state.exploration={kind:'theme',reader,theme:exploration.parentTheme};renderExplorer();$('#explorer-title').focus();});bindEvidence();
}
function closeExplorer(){
 const trigger=explorerTrigger;state.exploration=null;renderExplorer();
 const target=trigger?.kind==='seed'?$(`[data-seed="${trigger.id}"][data-reader="${trigger.reader}"]`,$('#detail-body')):$$('[data-theme]',$('#detail-body')).find(button=>button.dataset.reader===trigger?.reader&&button.dataset.theme===trigger?.theme);
 (target||$('#detail-title'))?.focus({preventScroll:true});
}
function openFavorite(id,trigger){
 const book=byId(id);if(!book||!state.a.includes(id)&&!state.b.includes(id))return;
 const dialog=$('#detail-dialog'),readers=['a','b'].filter(reader=>state[reader].includes(id)),links=favoriteReferences(state.results,id);lastDetailTrigger=trigger;detailMode='favorite';state.exploration=null;detailObserver?.disconnect();delete dialog.dataset.bookId;
 $('#detail-body').innerHTML=`<section class="favorite-inspector"><div class="favorite-cover" aria-hidden="true">${bookTile(book)}</div><div class="favorite-info"><p>${readers.map(readerName).join(' and ')} favorite</p><h2 id="detail-title" tabindex="-1">${escape(book.title)}</h2><p>${escape(book.author)} · ${book.year}</p><div class="evidence-tags">${book.tags.map(theme=>`<span>${escape(theme)}</span>`).join('')}</div><h3>Connected recommendations</h3><div class="favorite-links">${links.length?links.map(item=>`<button class="evidence-seed" data-candidate="${item.result.book.id}"><strong>${escape(item.result.book.title)}</strong><span>Reference for ${item.readers.map(readerName).join(' and ')}</span></button>`).join(''):'<p>No current explanation uses this favorite as its direct reference.</p>'}</div><button id="close-favorite" class="secondary">Back to taste galaxy</button></div></section>`;
 $$('[data-candidate]',$('#detail-body')).forEach(button=>button.onclick=()=>openDetail(button.dataset.candidate));$('#close-favorite').onclick=()=>dialog.close();
 if(!dialog.open)dialog.showModal();$('#detail-title').focus({preventScroll:true});
}

installBridge({
 read:()=>({a:[...state.a],b:[...state.b],mode:state.mode,stage:state.stage,fixture:'manual-tags-v1',recommendations:state.results.map(result=>result.book.id)}),
 apply:data=>{state.a=data.a;state.b=data.b;state.mode=data.mode;clearDecision(state);state.undo=null;state.handoff='';state.exploration=null;state.query='';state.filter='all';state.reader='a';const complete=state.a.length===5&&state.b.length===5;state.results=complete?recommend(state.a,state.b,state.mode):[];state.selected=state.results[0]?.book.id||null;state.stage=complete?'results':'select';render();},
 find:()=>showResults()
});

recorder.record('start');render();
