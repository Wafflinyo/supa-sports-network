import React,{useCallback,useEffect,useMemo,useState} from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';

const playerById=new Map(pool.map(player=>[Number(player.id),player]));
const entryKey=row=>String(row.team)+':'+String(row.player);
const ownRoster=(season,team)=>season?.rosters?.[team]||[];
const sameTeam=(left,right)=>Boolean(left&&right)&&String(left)===String(right);

export default function TradeBlockListings({league:l,onPropose}){
  const season=l.season;
  const admin=l.access.role==='commissioner';
  const gm=l.access.role==='gm';
  const canManage=admin||gm;
  const myTeam=gm?l.myTeam?.id||'':'';
  const [commissionerTeam,setCommissionerTeam]=useState('');
  const managementTeam=admin?commissionerTeam:myTeam;
  const [manageOpen,setManageOpen]=useState(false);
  const [listings,setListings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [problem,setProblem]=useState('');
  const [notice,setNotice]=useState('');
  const [editingPlayers,setEditingPlayers]=useState([]);
  const [teamNote,setTeamNote]=useState('');
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [multi,setMulti]=useState(false);
  const [selected,setSelected]=useState([]);
  const [pendingOffer,setPendingOffer]=useState([]);
  const [proposingTeam,setProposingTeam]=useState('');
  const seasonId=season?.id;
  const teams=season?.teams||[];
  const teamName=id=>teams.find(team=>sameTeam(team.id,id))?.name||'Unknown franchise';
  const load=useCallback(async()=>{
    if(!seasonId||!l.supabase){setListings([]);setLoading(false);return;}
    const response=await l.supabase.rpc('ssl_trade_block',{target_season:seasonId});
    if(response.error){setProblem(response.error.message);setLoading(false);return;}
    setListings(Array.isArray(response.data)?response.data:[]);
    setLoading(false);
  },[seasonId,l.supabase]);
  useEffect(()=>{
    setListings([]);setSelected([]);setMulti(false);setDirty(false);
    setManageOpen(false);setPendingOffer([]);setProposingTeam('');
    setLoading(true);setProblem('');setNotice('');
    load();
    const timer=setInterval(load,10000);
    return()=>clearInterval(timer);
  },[load]);
  useEffect(()=>{
    if(dirty)return;
    const mine=listings.filter(row=>sameTeam(row.team,managementTeam));
    setEditingPlayers(mine.map(row=>Number(row.player)));
    setTeamNote(mine[0]?.note||'');
  },[listings,managementTeam,dirty]);
  const available=useMemo(()=>listings.filter(row=>admin||!sameTeam(row.team,myTeam)),[listings,admin,myTeam]);
  const chosenRows=available.filter(row=>selected.includes(entryKey(row)));

  function goToManager(){
    setManageOpen(true);
    requestAnimationFrame(()=>document.getElementById('manage-trade-block')?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  function startOffer(rows){
    const candidates=rows.filter(row=>admin||!sameTeam(row.team,myTeam));
    if(!canManage){setProblem('Sign in as a franchise GM to propose a trade.');return;}
    if(!season?.tradingOpen){setProblem('Trade proposals are currently closed. Listed players remain visible.');return;}
    if(!candidates.length){setProblem('Choose at least one player from another team.');return;}
    if(admin){
      // Commissioner team selection is needed only when actually proposing,
      // never to view or select players from the public market.
      setPendingOffer(candidates);
      setProposingTeam('');
      setProblem('');
      return;
    }
    if(!myTeam){setProblem('Your GM franchise could not be determined.');return;}
    onPropose(candidates,myTeam);
    setSelected([]);setMulti(false);setProblem('');
  }
  function continueCommissionerOffer(){
    if(!proposingTeam){setProblem('Choose the franchise making this proposal.');return;}
    if(pendingOffer.some(row=>sameTeam(row.team,proposingTeam))){
      setProblem('The proposing team cannot acquire a player from its own roster. Choose a different team or remove that player from your selection.');
      return;
    }
    onPropose(pendingOffer,proposingTeam);
    setPendingOffer([]);setSelected([]);setMulti(false);setProblem('');
  }
  async function updateBlock(team,players,note){
    const response=await l.supabase.rpc('ssl_trade_block_update',{
      target_season:seasonId,acting_team:team,roster_players:players,team_note:note.trim()
    });
    if(response.error)throw response.error;
    await load();
  }
  async function saveBlock(){
    if(!seasonId||!managementTeam||saving||!dirty)return;
    setSaving(true);setProblem('');setNotice('');
    try{
      await updateBlock(managementTeam,editingPlayers,teamNote);
      setDirty(false);
      setNotice('Trade Block saved. Your updated listings are visible across the league.');
    }catch(error){setProblem(error.message||'Unable to update the Trade Block.');}
    finally{setSaving(false);}
  }
  async function removeListing(row){
    if(!canManage||(!admin&&!sameTeam(row.team,myTeam))||saving)return;
    if(dirty){setProblem('Save or cancel your pending roster changes before removing another listing.');goToManager();return;}
    setSaving(true);setProblem('');setNotice('');
    try{
      const same=listings.filter(item=>sameTeam(item.team,row.team));
      const remaining=same.filter(item=>Number(item.player)!==Number(row.player)).map(item=>Number(item.player));
      await updateBlock(row.team,remaining,same[0]?.note||'');
      setNotice((playerById.get(Number(row.player))?.name||'Player')+' was removed from '+teamName(row.team)+'’s Trade Block.');
    }catch(error){setProblem(error.message||'Unable to remove this listing.');}
    finally{setSaving(false);}
  }
  if(!season)return <section className="panel season-box"><h2>TRADE BLOCK</h2><p>No active SSL season yet.</p></section>;
  return <div className="trade-block-page">
    <section className="panel season-box">
      <h2>LEAGUE TRADE BLOCK</h2>
      <p>All listed players from every franchise appear together below. No team selection is needed to browse the market. Each player shows their current team and any message from that GM.</p>
      <div className="trade-block-actions">
        {canManage&&<button type="button" className="outline-btn" onClick={goToManager}>
          {admin?'MANAGE A TEAM’S TRADE BLOCK':'OPEN MY ROSTER · MANAGE TRADE BLOCK'}
        </button>}
        {canManage&&<button type="button" className="outline-btn" aria-pressed={multi} onClick={()=>{setMulti(v=>!v);setSelected([]);setPendingOffer([]);}}>
          {multi?'CANCEL MULTIPLE':'SELECT MULTIPLE'}
        </button>}
        {multi&&canManage&&<button type="button" className="red-btn"
          disabled={!chosenRows.length||!season.tradingOpen}
          onClick={()=>startOffer(chosenRows)}>
          BUILD TRADE WITH {chosenRows.length} PLAYER{chosenRows.length===1?'':'S'}
        </button>}
      </div>
      {problem&&<p className="inline-message season-error" role="alert">{problem}</p>}
      {notice&&<p className="inline-message" role="status">{notice}</p>}
      {admin&&pendingOffer.length>0&&<section className="trade-block-offer-team" aria-label="Choose proposing team">
        <h3>BUILD YOUR TRADE PROPOSAL</h3>
        <p>{pendingOffer.length} selected player{pendingOffer.length===1?'':'s'} · {new Set(pendingOffer.map(row=>row.team)).size} selling franchise{new Set(pendingOffer.map(row=>row.team)).size===1?'':'s'}</p>
        <label>Propose on behalf of
          <select aria-label="Team making trade proposal" value={proposingTeam} onChange={e=>{setProposingTeam(e.target.value);setProblem('');}}>
            <option value="">Choose proposing franchise</option>
            {teams.map(team=><option value={team.id} key={team.id}>{team.name}</option>)}
          </select>
        </label>
        <div className="trade-block-actions">
          <button type="button" className="red-btn" onClick={continueCommissionerOffer} disabled={!proposingTeam}>CONTINUE TO TRADE PROPOSAL</button>
          <button type="button" className="outline-btn" onClick={()=>{setPendingOffer([]);setProposingTeam('');}}>CANCEL</button>
        </div>
      </section>}
      {loading&&<p>Loading the league-wide Trade Block…</p>}
      {!loading&&!listings.length&&<p>No players are currently listed. Once a GM puts someone on the block, every visitor and GM will see that player here.</p>}
      <p className="trade-block-market-count">{listings.length} PLAYER{listings.length===1?'':'S'} ON THE MARKET</p>
      <div className="trade-block-player-grid" aria-label="All listed SSL players">
        {listings.map(row=>{
          const player=playerById.get(Number(row.player));
          const key=entryKey(row);
          const own=sameTeam(row.team,myTeam);
          const chosen=selected.includes(key);
          const allowed=canManage&&(admin||!own);
          return <article key={key} className={'trade-block-market-card'+(chosen?' selected':'')}>
            <button type="button" className="trade-block-player"
              aria-pressed={multi?chosen:undefined}
              disabled={!allowed}
              title={!canManage?'Sign in as a GM to offer a trade':own?'Your own listed player':undefined}
              onClick={()=>{
                if(multi)setSelected(current=>current.includes(key)?current.filter(id=>id!==key):[...current,key]);
                else startOffer([row]);
              }}>
              {multi&&allowed&&<span className="trade-block-select-indicator" aria-hidden="true">{chosen?'☑':'☐'}</span>}
              {player&&<PlayerPortrait player={player} size={50}/>}
              <span className="trade-block-card-details">
                <strong className="trade-block-player-name">{player?.name||'Player #'+row.player}</strong>
                <span className="trade-block-market-team">TEAM: {teamName(row.team)}</span>
                {row.note&&<span className="trade-block-market-note">“{row.note}”</span>}
                <span className="trade-block-player-action">{own?'ON YOUR TRADE BLOCK':multi?'SELECT PLAYER':'MAKE OFFER'}</span>
              </span>
            </button>
            {(admin||own)&&<button className="trade-block-remove" type="button"
              disabled={saving} onClick={()=>removeListing(row)}>
              REMOVE FROM TRADE BLOCK
            </button>}
          </article>;
        })}
      </div>
      {!canManage&&<p className="trade-block-readonly-note">The market is public. Sign in as a GM to propose trades or manage your team's listed players.</p>}
    </section>
    {canManage&&manageOpen&&<section className="panel season-box" id="manage-trade-block" aria-label="Manage roster trade listings">
      <h2>{admin?'MANAGE FRANCHISE TRADE BLOCK':'MY ROSTER · TRADE BLOCK'}</h2>
      {admin&&<label className="trade-block-management-selector">Team to manage
        <select aria-label="Choose team to manage trade listings" value={commissionerTeam}
          onChange={e=>{setCommissionerTeam(e.target.value);setDirty(false);setProblem('');setNotice('');}}>
          <option value="">Choose a franchise to manage</option>
          {teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </label>}
      {!managementTeam?<p>{admin?'Choose a franchise here to add or remove its listed players.':'Your GM franchise could not be determined.'}</p>:<>
        <p><strong>{teamName(managementTeam)}</strong> · Check players currently on this roster to list them publicly. Uncheck to remove a listing, then save. You can change your mind at any time.</p>
        <div className="trade-block-roster">
          {ownRoster(season,managementTeam).map(id=>{
            const player=playerById.get(Number(id));
            const checked=editingPlayers.includes(Number(id));
            return <label key={id} className={'trade-block-roster-option'+(checked?' listed':'')}>
              <input type="checkbox" checked={checked}
                onChange={event=>{setDirty(true);setEditingPlayers(previous=>event.target.checked?[...previous,Number(id)]:previous.filter(p=>p!==Number(id)));}}/>
              {player&&<PlayerPortrait player={player} size={36}/>}
              <span>{player?.name||'Player #'+id}{checked&&<small> ON TRADE BLOCK</small>}</span>
            </label>;
          })}
        </div>
        <label className="trade-block-message-label">Message to the league (optional)
          <textarea value={teamNote} maxLength={240} rows={3}
            placeholder="Looking for a pitcher / Looking for power, willing to negotiate"
            onChange={event=>{setDirty(true);setTeamNote(event.target.value);}}/>
        </label>
        <div className="trade-block-actions">
          <button className="red-btn" type="button" disabled={saving||l.busy||!dirty} onClick={saveBlock}>
            {saving?'SAVING…':'SAVE TRADE BLOCK'}
          </button>
          <button className="outline-btn" type="button" onClick={()=>{setDirty(false);setManageOpen(false);setProblem('');}}>CLOSE ROSTER</button>
        </div>
        {dirty&&<p className="trade-block-unsaved" role="status">Unsaved changes · Save to publish additions or removals.</p>}
      </>}
    </section>}
  </div>;
}
