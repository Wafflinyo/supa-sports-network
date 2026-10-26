import React from "react";
import {CheckCircle2, Clock3, UserRoundCheck, UsersRound} from "lucide-react";

/**
 * Team-by-team participation view, visible to commissioners only.
 * Tracks All-Star and award ballots. The franchise association comes
 * from the account's latest GM-code login before ballot submission.
 */
export function CommissionerVoteTracker({teams=[],votedIds=[],voters=null,error="",type="ballot"}) {
  const isBallot=type==="ballot";
  const knownVotes=new Set(votedIds.map(String));
  const submitted=teams.filter(t=>knownVotes.has(String(t.id)));
  const missing=teams.filter(t=>!knownVotes.has(String(t.id)));
  const percent=teams.length ? submitted.length/teams.length*100 : 0;

  function teamEntries(items, complete){
    return items.length ? <ul className="ssl-voter-list">
      {items.map(t=><li key={t.id} className={complete?"is-complete":"is-missing"}>
        {complete?<CheckCircle2 size={17}/>:<Clock3 size={17}/>}
        <span>{t.name}</span>
        <strong>{complete?"VOTED":"NOT VOTED"}</strong>
      </li>)}
    </ul> : <p className="ssl-voter-empty">{complete?"No franchise votes recorded yet.":"All franchises accounted for!"}</p>;
  }

  return <section className="ssl-voter-tracker" aria-label="Commissioner voter participation tracker">
    <div className="ssl-voter-heading">
      <div className="ssl-voter-heading-title">
        <span className="ssl-voter-eyebrow"><UsersRound size={15}/> COMMISSIONER ONLY</span>
        <h3>WHO HAS VOTED?</h3>
        <p>{"Franchises with a recognized GM account ballot and teams still awaiting one."}</p>
      </div>
      <div className="ssl-voter-tally"><strong>{submitted.length} / {teams.length}</strong><span>{"GM TEAMS REPRESENTED"}</span></div>
    </div>
    <div className="ssl-voter-progress" role="progressbar" aria-label="Franchises with a recorded vote" aria-valuenow={submitted.length} aria-valuemin={0} aria-valuemax={teams.length}>
      <span style={{width:percent+"%"}}/>
    </div>
    {isBallot && voters===null ? <p className="ssl-voter-loading">{error? "Unable to retrieve ballot account names: "+error:"Loading submitted account ballots…"}</p> :
      <div className="ssl-voter-columns">
        <div className="ssl-voter-group">
          <h4><CheckCircle2 size={17}/> VOTED <span>{submitted.length}</span></h4>
          {teamEntries(submitted,true)}
        </div>
        <div className="ssl-voter-group">
          <h4><Clock3 size={17}/> STILL MISSING <span>{missing.length}</span></h4>
          {teamEntries(missing,false)}
        </div>
      </div>
    }
    {isBallot && Array.isArray(voters) && <div className="ssl-voter-accounts">
      <h4><UserRoundCheck size={18}/> SUBMITTED ACCOUNT BALLOTS <span>{voters.length}</span></h4>
      {voters.length ? <ul className="ssl-voter-account-list">
        {voters.map((v,i)=>{
          const team=teams.find(t=>String(t.id)===String(v.teamId));
          return <li key={String(v.username)+i}>
            <strong>{v.username}</strong>
            <span>{team?.name||"No linked GM franchise"}</span>
          </li>;
        })}
      </ul> : <p className="ssl-voter-empty">No accounts have submitted this ballot yet.</p>}
      <p className="ssl-voter-disclaimer">All submitted accounts are shown, including non-GM voters. The franchise checklist uses the account's last known GM-code sign-in before submission; unlinked ballots are listed but cannot verify a franchise GM's participation.</p>
    </div>}
  </section>;
}
