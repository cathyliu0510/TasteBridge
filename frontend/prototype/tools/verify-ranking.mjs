import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reconcileRanking} from '../src/a/desk-ranking.mjs';

const results=(...ids)=>ids.map(id=>({book:{id}}));
const originalResults=results('one','two','three','four','five');
const stateWith=(changes={})=>({
 a:['seed-a'],b:['seed-b'],results:originalResults,mode:'least-misery',
 votes:{},choice:null,selected:'one',deferred:false,...changes
});

test('retains every response for surviving candidates and counts removed reader responses',()=>{
 const state=stateWith({votes:{
  one:{a:'yes',b:'unsure'},two:{a:'yes',b:'no'},
  three:{a:'no'},five:{b:'unsure'}
 }});
 const next=results('three','one','six','seven','eight');
 const summary=reconcileRanking(state,next,'average');
 assert.deepEqual(summary,{removedVoteCount:3,choiceChanged:false});
 assert.deepEqual(state.votes,{one:{a:'yes',b:'unsure'},three:{a:'no'}});
 assert.deepEqual(state.results,next);
 assert.equal(state.mode,'average');
 assert.equal(state.selected,'one');
 assert.equal(state.choice,null);
});

test('keeps an explicitly confirmed choice with two Interested responses after reordering',()=>{
 const state=stateWith({votes:{three:{a:'yes',b:'yes'}},choice:'three',selected:'three'});
 const summary=reconcileRanking(state,results('five','three','one','two','four'),'average');
 assert.deepEqual(summary,{removedVoteCount:0,choiceChanged:false});
 assert.equal(state.choice,'three');
 assert.equal(state.selected,'three');
 assert.equal(state.deferred,false);
});

test('revokes a retained choice unless both readers remain Interested',()=>{
 for(const responses of [{a:'yes',b:'no'},{a:'yes',b:'unsure'},{a:'yes'}]){
  const state=stateWith({votes:{one:responses},choice:'one'});
  const summary=reconcileRanking(state,results('five','four','three','two','one'),'average');
  assert.equal(state.choice,null);
  assert.equal(summary.choiceChanged,true);
  assert.equal(summary.removedVoteCount,0);
  assert.deepEqual(state.votes.one,responses);
 }
});

test('drops an absent confirmed book without choosing another mutually Interested book',()=>{
 const state=stateWith({votes:{two:{a:'yes',b:'yes'},three:{a:'yes',b:'yes'}},choice:'two'});
 const summary=reconcileRanking(state,results('three','one','six','seven','eight'),'average');
 assert.deepEqual(summary,{removedVoteCount:2,choiceChanged:true});
 assert.equal(state.choice,null);
 assert.deepEqual(state.votes,{three:{a:'yes',b:'yes'}});
});

test('two retained Interested responses never create a new joint confirmation',()=>{
 const state=stateWith({votes:{one:{a:'yes',b:'yes'}}});
 const summary=reconcileRanking(state,results('two','one','three','four','five'),'average');
 assert.equal(state.choice,null);
 assert.equal(summary.choiceChanged,false);
});

test('falls back to the first new candidate when the selected book disappears',()=>{
 const state=stateWith({selected:'two'});
 reconcileRanking(state,results('three','one','six','seven','eight'),'average');
 assert.equal(state.selected,'three');
});

test('preserves decide-later unless a valid confirmed choice remains',()=>{
 const scenarios=[
  {input:{deferred:true},expected:true},
  {input:{deferred:false},expected:false},
  {input:{deferred:true,choice:'one',votes:{one:{a:'yes',b:'unsure'}}},expected:true},
  {input:{deferred:true,choice:'one',votes:{one:{a:'yes',b:'yes'}}},expected:false}
 ];
 for(const {input,expected} of scenarios){
  const state=stateWith(input);
  reconcileRanking(state,results('five','four','three','two','one'),'average');
  assert.equal(state.deferred,expected);
 }
 const dropped=stateWith({deferred:true,choice:'two',votes:{two:{a:'yes',b:'yes'}}});
 reconcileRanking(dropped,results('three','one','six','seven','eight'),'average');
 assert.equal(dropped.deferred,true);
 assert.equal(dropped.choice,null);
});

test('empty results clear candidates and selection while retaining decide-later',()=>{
 const state=stateWith({votes:{one:{a:'yes',b:'yes'}},choice:'one',deferred:true});
 assert.deepEqual(reconcileRanking(state,[],'average'),{removedVoteCount:2,choiceChanged:true});
 assert.deepEqual(state.results,[]);
 assert.deepEqual(state.votes,{});
 assert.equal(state.choice,null);
 assert.equal(state.selected,null);
 assert.equal(state.deferred,true);
});

test('copies vote containers and the ranking array without changing seeds or unrelated state',()=>{
 const one=Object.freeze({a:'yes',b:'unsure'}),two=Object.freeze({a:'no'});
 const previousVotes=Object.freeze({one,two});
 const next=Object.freeze(results('three','one','six','seven','eight'));
 const undo={reader:'a',before:['previous-seed']};
 const state=stateWith({votes:previousVotes,undo,stage:'results',handoff:'Kept'});
 const seedA=state.a,seedB=state.b;
 reconcileRanking(state,next,'average');
 assert.notEqual(state.votes,previousVotes);
 assert.notEqual(state.votes.one,one);
 assert.notEqual(state.results,next);
 assert.deepEqual(state.results,next);
 state.votes.one.a='no';
 assert.deepEqual(previousVotes,{one:{a:'yes',b:'unsure'},two:{a:'no'}});
 assert.equal(state.a,seedA);
 assert.equal(state.b,seedB);
 assert.equal(state.undo,undo);
 assert.equal(state.stage,'results');
 assert.equal(state.handoff,'Kept');
 assert.deepEqual(originalResults.map(result=>result.book.id),['one','two','three','four','five']);
});
