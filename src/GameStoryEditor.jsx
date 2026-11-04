import React,{useEffect,useState} from 'react';
import {inningScoringDrama} from './rio-inning-scores.js';

// The commissioner verifies scoring sequence details not available in Rio.
// Never invent lead swaps, late rallies, or walk-offs from final scores alone.
export default function GameStoryEditor({league,game}){
 const saved=game.story||{};
 const calculated=inningScoringDrama(game.result?.innings);
 const [leadChanges,setLeadChanges]=useState(String(saved.leadChanges??0));
 const [lateFinish,setLateFinish]=useState(saved.lateFinish||'none');
 const [note,setNote]=useState(saved.note||'');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   setLeadChanges(String(game.story?.leadChanges??0));
   setLateFinish(game.story?.lateFinish||'none');
   setNote(game.story?.note||'');
 },[game.id,game.story?.leadChanges,game.story?.lateFinish,game.story?.note]);
 const submit=async event=>{
   event.preventDefault();setError('');setFeedback('');
   const count=calculated?.leadChanges??Number(leadChanges);
   if(!Number.isInteger(count)||count<0||count>20){
     setError('Enter a whole number of confirmed lead changes, from 0 to 20.');return;
   }
   setBusy(true);
   try{
     const response=await league.supabase.rpc('ssl_game_story_save',{
       target_season:league.season.id,target_game:game.id,
       story:{leadChanges:count,lateFinish:calculated?.lateFinish??lateFinish,note:note.trim()},
     });
     if(response.error)throw response.error;
     await league.refresh();
     setFeedback(game.stage==='final'
       ?'Verified game story saved. The published headline has been updated.'
       :'Game story saved privately. It will appear only after official result release.');
   }catch(e){setError(e.message||'Could not save verified game story.');}
   finally{setBusy(false);}
 };
 return <details className="ssl-game-story-editor">
   <summary>GAME STORY · LEAD CHANGES / LAST-INNING FINISH</summary>
   {calculated?<p role="status"><strong>Automatically read from Project Rio Game Info:</strong>
     {' '}{calculated.inningCount} innings · {calculated.leadChanges} lead changes ·
     {' '}{calculated.lateFinish==='walkoff'?'Walk-off finish':
       calculated.lateFinish==='late-comeback'?'Late comeback':'No final-inning reversal'}.
     You do not need to confirm these; they update whenever the report changes.</p>:
     <p>This older game report has no saved inning-by-inning scoring.
       Replace its private report with a Game Info sheet to calculate lead changes automatically.</p>}
   <form className="season-form" onSubmit={submit}>
     {!calculated&&<div className="season-inline">
       <label>Confirmed lead changes (older reports only)
         <input type="number" min="0" max="20" step="1" required
           value={leadChanges} onChange={e=>setLeadChanges(e.target.value)}/>
       </label>
       <label>How did the game end?
         <select value={lateFinish} onChange={e=>setLateFinish(e.target.value)}>
           <option value="none">No confirmed late finish</option>
           <option value="late-comeback">Late-inning comeback</option>
           <option value="walkoff">Walk-off / final-play win</option>
         </select>
       </label>
     </div>}
     <label>Additional verified game detail (optional)
       <textarea maxLength={240} rows={2} value={note}
         placeholder="Example: A two-run rally in the bottom of the seventh broke the tie."
         onChange={e=>setNote(e.target.value)}/>
     </label>
     <button type="submit" className="outline-btn" disabled={busy||league.busy}>
       {busy?'SAVING GAME STORY…':'SAVE VERIFIED GAME STORY'}
     </button>
     {error&&<p className="season-error" role="alert">{error}</p>}
     {feedback&&<p className="season-saved" role="status">{feedback}</p>}
   </form>
 </details>;
}
