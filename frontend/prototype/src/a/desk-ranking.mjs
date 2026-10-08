import {bothWilling} from './desk-decision.mjs';

/**
 * Reconcile a new ranking without treating unchanged books as new opinions.
 * Updates the supplied state only. Result records are read-only inputs; the
 * result array and retained per-book vote objects are copied. Seed edits still
 * use clearDecision rather than this transition.
 *
 * removedVoteCount counts discarded reader responses (a/b), not books.
 */
export function reconcileRanking(state,nextResults,nextMode){
 const candidateIds=new Set(nextResults.map(result=>result.book.id));
 const retainedVotes=[];
 let removedVoteCount=0;

 for(const [id,responses] of Object.entries(state.votes||{})){
  if(candidateIds.has(id))retainedVotes.push([id,{...responses}]);
  else removedVoteCount+=['a','b'].filter(reader=>responses?.[reader]!==undefined).length;
 }

 const votes=Object.fromEntries(retainedVotes);
 const previousChoice=state.choice??null;
 const choice=candidateIds.has(previousChoice)&&bothWilling(votes[previousChoice])?previousChoice:null;
 const selected=candidateIds.has(state.selected)?state.selected:nextResults[0]?.book.id??null;
 const deferred=choice!==null?false:state.deferred===true;

 Object.assign(state,{results:[...nextResults],mode:nextMode,votes,choice,selected,deferred});
 return {removedVoteCount,choiceChanged:choice!==previousChoice};
}
