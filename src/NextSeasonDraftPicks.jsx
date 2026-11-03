import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeftRight} from 'lucide-react';
import {nextSeasonPickSummary} from './next-season-roster-picks.js';
import {teamLogo} from './TeamIdentity.jsx';

// A read-only picker inside the existing GM/Commissioner Tools > Roster tab.
// GMs may inspect any club's next-season assets without composing a trade.
// Only the roster editor itself is restricted to a GM's own franchise.
export default function NextSeasonDraftPicks({season,teamId,supabase}){
  const [viewTeam,setViewTeam]=useState('');
  useEffect(()=>setViewTeam(''),[season?.id,teamId]);
  const selected=season?.teams?.some(t=>String(t.id)===String(viewTeam))
    ?viewTeam:teamId;
  const team=(season?.teams||[]).find(t=>String(t.id)===String(selected));
  const summary=useMemo(()=>nextSeasonPickSummary(season,selected),[season,selected]);
  return <div className="ssl-future-picks" aria-label="Next-season draft pick ownership">
    <div className="ssl-future-picks-intro">
      <div>
        <strong>SEASON {summary.nextSeason} · DRAFT PICKS</strong>
        <p>Current ownership after approved trades. The original team is shown for every pick, so acquired and traded-away picks are easy to identify.</p>
      </div>
      <label>View picks for
        <select aria-label="View another team's next-season draft picks" value={selected||''}
          onChange={e=>setViewTeam(e.target.value)}>
          {(season?.teams||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </div>
    {!summary.available?<p className="ssl-future-picks-empty">
      Next-season draft pick allocations are not available in the current season record yet.
    </p>:<>
      <div className="ssl-future-picks-current">
        <div className="ssl-future-picks-owner">
          {team?.logoPath&&supabase?<img src={teamLogo(supabase,team.logoPath)} alt=""/>:null}
          <div><small>VIEWING FRANCHISE</small><h3>{team?.name||'Team'}</h3></div>
        </div>
        <div className="ssl-future-picks-count"><strong>{summary.owned.length}</strong>
          <span>currently owned</span></div>
      </div>
      {summary.owned.length?<div className="ssl-future-picks-grid">
        {summary.owned.map(p=><div className={'ssl-future-pick'+(p.acquired?' acquired':'')}
          key={String(p.id)}>
          <strong>ROUND {p.displayRound}</strong>
          <span>{p.acquired?'ACQUIRED PICK':'ORIGINAL PICK'}</span>
          <small>{p.acquired?'Originally '+p.originName:'Originally this franchise'}</small>
        </div>)}
      </div>:<p className="ssl-future-picks-empty">This franchise does not currently own any tradable next-season player picks.</p>}
      {!!summary.tradedAway.length&&<details className="ssl-future-picks-sent">
        <summary><ArrowLeftRight size={16}/> VIEW TRADED-AWAY PICKS ({summary.tradedAway.length})</summary>
        <ul>{summary.tradedAway.map(p=><li key={String(p.id)}>
          <strong>Round {p.displayRound}</strong><span>Now owned by {p.currentOwnerName}</span>
        </li>)}</ul>
      </details>}
    </>}
    <p className="ssl-future-picks-footnote">This list tracks tradable player draft picks, not non-tradable Stadium Picks. Stadium Pick eligibility is determined separately by the league's Stadium retention rules.</p>
  </div>;
}
