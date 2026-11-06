import React,{useCallback,useEffect,useMemo,useState} from 'react';
import pool from './players.json';
import {PlayerPortrait} from './PlayerPortrait.jsx';

const playerById=new Map(pool.map(player=>[Number(player.id),player]));
const entryKey=row=>String(row.team)+':'+String(row.player);
const ownRoster=(season,team)=>season?.rosters?.[team]||[];

export default function TradeBlockListings({league:l,onPropose}){
  const season=l.season;
  const admin=l.access.role==='commissioner';
  const canManage=admin||l.access.role==='gm';
  const [commissionerTeam,setCommissionerTeam]=useState('');
  const actingTeam=admin?commissionerTeam:l.myTeam?.id||'';
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
  const seasonId=season?.id;
  const load=useCallback(async()=>{
    if(!seasonId||!l.supabase){setListings([]);setLoading(false);return;}
    const response=await l.supabase.rpc('ssl_trade_block',{target_season:seasonId});
    if(response.error){setProblem(response.error.message);setLoading(false);return;}
    setListings(Array.isArray(response.data)?response.data:[]);
    setProblem('');
    setLoading(false);
  },[seasonId,l.supabase]);
  useEffect(()=>{
    setListings([]);setSelected([]);setMulti(false);setDirty(false);setLoading(true);setNotice('');
    load();
    const timer=setInterval(load,10000);
    return()=>clearInterval(timer);
  },[load]);
  useEffect(()=>{
    if(dirty)return;
    const mine=listings.filter(row=>row.team===actingTeam);
    setEditingPlayers(mine.map(row=>Number(row.player)));
    setTeamNote(mine[0]?.note||'');
  },[listings,actingTeam,dirty]);
  const teams=season?.teams||[];
  const grouped=useMemo(()=>teams.map(team=>({
    team,
    rows:listings.filter(row=>String(row.team)===String(team.id))
  })).filter(group=>group.rows.length),[teams,listings]);
  const eligible=useMemo(()=>listings.filter(row=>row.team!==actingTeam),[listings,actingTeam]);
  const selectedRows=eligible.filter(row=>selected.includes(entryKey(row)));
  const offer=rows=>{
    if(!canManage){setProblem('Sign in as a franchise GM to propose a trade.');return;}
    if(!actingTeam){setProblem('Choose the franchise making this offer first.');return;}
    if(!season?.tradingOpen){setProblem('Proposals are currently closed. The trade block remains visible.');return;}
    const eligibleRows=rows.filter(row=>row.team!==actingTeam);
    if(!eligibleRows.length){setProblem('Select at least one player from another team.');return;}
    onPropose(eligibleRows,actingTeam);
    setSelected([]);setMulti(false);setProblem('');
  };
  async function saveBlock(){
    if(!seasonId||!actingTeam||saving)return;
    setSaving(true);setProblem('');setNotice('');
    try{
      const response=await l.supabase.rpc('ssl_trade_block_update',{
        target_season:seasonId,acting_team:actingTeam,
        roster_players:editingPlayers,team_note:teamNote.trim()
      });
      if(response.error)throw response.error;
      setDirty(false);setNotice('Your Trade Block has been updated.');
      await load();
    }catch(e){setProblem(e.message||'Unable to save your Trade Block.');}
    finally{setSaving(false);}
  }
  if(!season)return <section className="panel season-box"><h2>TRADE BLOCK</h2><p>No active SSL season yet.</p></section>;
  return <div className="trade-block-page">
    <section className="panel season-box">
      <h2>LEAGUE TRADE BLOCK</h2>
      <p>See which players teams are willing to trade and what each GM is looking for. Select a player to begin an offer, or choose <strong>SELECT MULTIPLE</strong> to build one proposal with players from different franchises.</p>
      {canManage&&<div className="trade-block-actions">
        {admin&&<label>Proposing / managing franchise
          <select aria-label="Acting franchise" value={commissionerTeam} onChange={e=>{setCommissionerTeam(e.target.value);setDirty(false);setSelected([]);}}>
            <option value="">Choose a franchise</option>
            {teams.map(team=><option value={team.id} key={team.id}>{team.name}</option>)}
          </select>
        </label>}
        <button type="button" className="outline-btn" aria-pressed={multi} onClick={()=>{setMulti(v=>!v);setSelected([]);}}>
          {multi?'CANCEL MULTIPLE':'SELECT MULTIPLE'}
        </button>
        {multi&&<button type="button" className="red-btn" disabled={!selectedRows.length||!actingTeam||!season.tradingOpen} onClick={()=>offer(selectedRows)}>
          PROPOSE TRADE FOR {selectedRows.length} PLAYER{selectedRows.length===1?'':'S'}
        </button>}
      </div>}
      {problem&&<p className="inline-message season-error" role="alert">{problem}</p>}
      {loading&&<p>Loading the Trade Block…</p>}
      {!loading&&!grouped.length&&<p>No players have been placed on the Trade Block yet.</p>}
      <div className="trade-block-team-list">
        {grouped.map(({team,rows})=><section key={team.id} className="trade-block-team">
          <h3>{team.name} <small>· {rows.length} PLAYER{rows.length===1?'':'S'}</small></h3>
          {!!rows[0]?.note&&<p className="trade-block-team-note">“{rows[0].note}”</p>}
          <div className="trade-block-player-grid">
            {rows.map(row=>{
              const player=playerById.get(Number(row.player));
              const key=entryKey(row);
              const own=String(row.team)===String(actingTeam);
              const chosen=selected.includes(key);
              return <button key={key} type="button" className={'trade-block-player'+(chosen?' selected':'')}
                aria-pressed={multi?chosen:undefined}
                disabled={!canManage||(!multi&&own)}
                title={!canManage?'Sign in as a GM to propose a trade':own?'This player is on your own roster':undefined}
                onClick={()=>{
                  if(multi){if(own)return;setSelected(a=>a.includes(key)?a.filter(id=>id!==key):[...a,key]);}
                  else offer([row]);
                }}>
                {multi&&<span className="trade-block-select-indicator" aria-hidden="true">{chosen?'☑':'☐'}</span>}
                {player&&<PlayerPortrait player={player} size={48}/>}
                <span className="trade-block-player-name">{player?.name||'Player #'+row.player}</span>
                <span className="trade-block-player-action">{own?'YOUR PLAYER':multi?'SELECT':'MAKE OFFER'}</span>
              </button>;
            })}
          </div>
        </section>)}
      </div>
      {!canManage&&<p className="trade-block-readonly-note">Everyone can browse the Trade Block. GMs can sign in to make offers.</p>}
    </section>
    {canManage&&<section className="panel season-box" id="manage-trade-block">
      <h2>MANAGE YOUR TRADE BLOCK</h2>
      {!actingTeam?<p>Choose a franchise above to manage its listings.</p>:<>
        <p>Select players currently on your roster. They will appear publicly under your team. Uncheck a player and save to take them off the block.</p>
        <div className="trade-block-roster">
          {ownRoster(season,actingTeam).map(id=>{
            const player=playerById.get(Number(id));
            return <label key={id} className="trade-block-roster-option">
              <input type="checkbox" checked={editingPlayers.includes(Number(id))}
                onChange={e=>{setDirty(true);setEditingPlayers(previous=>e.target.checked?[...previous,Number(id)]:previous.filter(p=>p!==Number(id)));}}/>
              {player&&<PlayerPortrait player={player} size={34}/>}
              <span>{player?.name||'Player #'+id}</span>
            </label>;
          })}
        </div>
        <label className="trade-block-message-label">Message to the league (optional)
          <textarea value={teamNote} maxLength={240} rows={3}
            placeholder="Looking for a pitcher… / Looking for power, willing to negotiate…"
            onChange={e=>{setDirty(true);setTeamNote(e.target.value);}}/>
        </label>
        <button className="red-btn" type="button" disabled={saving||l.busy||!dirty} onClick={saveBlock}>
          {saving?'SAVING…':'SAVE TRADE BLOCK'}
        </button>
        {notice&&<p className="inline-message" role="status">{notice}</p>}
      </>}
    </section>}
  </div>;
}
