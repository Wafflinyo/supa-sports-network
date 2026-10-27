import React,{useEffect,useState} from 'react';
import {homeStadium} from './matchup-display.js';
import {homeGames,homeOpponent,supportsStadiumVariant,canEditStadiumVariant} from './stadium-lighting.js';
import {Sun,Moon,CheckCircle2,CalendarClock,MapPin,LockKeyhole} from 'lucide-react';
import './gm-stadium-matchups.css';

const dateLabel=value=>value?new Intl.DateTimeFormat('en-US',{
  dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'
}).format(new Date(value))+' ET':'DATE & TIME TBD';

function MatchupSetting({league:l,game,teamId,stadium}){
  const s=l.season;
  const [choice,setChoice]=useState(game.stadiumVariant||'');
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    setChoice(game.stadiumVariant||'');
  },[game.id,game.stadiumVariant]);
  const hasVersions=supportsStadiumVariant(stadium);
  const eligible=canEditStadiumVariant(s,game,teamId);
  const current=hasVersions&&['Day','Night'].includes(game.stadiumVariant)?game.stadiumVariant:null;
  async function save(){
    if(!eligible||!['Day','Night'].includes(choice)||choice===current||saving||l.busy)return;
    setSaving(true);setError('');setNotice('');
    try{
      const {error:rpcError}=await l.supabase.rpc('ssl_set_stadium_variant',{
        p_season:s.id,p_game:String(game.id),p_variant:choice
      });
      if(rpcError)throw rpcError;
      await l.refresh();
      setNotice(choice+' version saved for this home matchup.');
    }catch(e){setError(e?.message||'Could not save Stadium version.');}
    finally{setSaving(false);}
  }
  return <article className="gm-stadium-game" aria-label={'Home game against '+homeOpponent(s,game)}>
    <div className="gm-stadium-game-top">
      <div>
        <small>WEEK {game.week||'TBD'} · {game.phase==='playoffs'?'PLAYOFF HOME GAME':'REGULAR SEASON · HOME'}</small>
        <h3>{homeOpponent(s,game)} <span className="gm-stadium-at">@</span> {s.teams.find(t=>String(t.id)===String(teamId))?.name||'Your Team'}</h3>
        <p><MapPin size={15}/>{stadium||'HOME STADIUM TBD'} <span aria-hidden="true">·</span> <CalendarClock size={15}/>{dateLabel(game.startsAt)}</p>
      </div>
      <div className="gm-stadium-current">
        {hasVersions ? current
          ? <span className="gm-stadium-saved"><CheckCircle2 size={16}/> {current.toUpperCase()} SELECTED</span>
          : <span className="gm-stadium-unselected">DAY / NIGHT NOT SELECTED</span>
          : <span className="gm-stadium-fixed">SINGLE STADIUM VERSION</span>}
      </div>
    </div>
    {hasVersions&&(eligible?<div className="gm-stadium-controls">
      <div className="gm-stadium-choices" role="group" aria-label={'Select Day or Night for Week '+(game.week||'TBD')}>
        <button type="button" className={choice==='Day'?'selected':''}
          aria-pressed={choice==='Day'} onClick={()=>{setChoice('Day');setNotice('');setError('');}} disabled={saving}>
          <Sun size={20}/> DAY</button>
        <button type="button" className={choice==='Night'?'selected':''}
          aria-pressed={choice==='Night'} onClick={()=>{setChoice('Night');setNotice('');setError('');}} disabled={saving}>
          <Moon size={20}/> NIGHT</button>
      </div>
      <button type="button" className="red-btn" onClick={save}
        disabled={!choice||choice===current||saving||l.busy}>
        {saving?'SAVING…':current?'UPDATE DAY / NIGHT':'SAVE DAY / NIGHT'}
      </button>
    </div>:<p className="gm-stadium-readonly"><LockKeyhole size={14}/> {game.stage==='scheduled'?'Selection is unavailable for this matchup.':'This matchup is locked; Stadium selection can no longer change.'}</p>)}
    {notice&&<p role="status" className="gm-stadium-notice">{notice}</p>}
    {error&&<p role="alert" className="gm-stadium-error">{error}</p>}
  </article>;
}
export default function GmStadiumMatchups({league:l}){
  const s=l.season,team=l.myTeam;
  if(!s||!team)return <section className="panel season-box"><h2>HOME MATCHUPS · DAY / NIGHT</h2><p>Your home games will appear after the draft and schedule are generated.</p></section>;
  const games=homeGames(s,team.id);
  const stadium=homeStadium(s,team.id);
  const selectable=supportsStadiumVariant(stadium);
  const upcoming=games.filter(g=>g.stage==='scheduled'&&!g.lockedAt);
  const missing=upcoming.filter(g=>selectable&&!['Day','Night'].includes(g.stadiumVariant)).length;
  return <section className="panel season-box gm-stadium-workspace">
    <div className="gm-stadium-workspace-heading">
      <span>GM TOOLS · HOME FIELD MANAGEMENT</span>
      <h2>YOUR HOME MATCHUPS</h2>
      <p>Choose <strong>Day</strong> or <strong>Night</strong> for home games at Stadiums that offer both versions. You can set <strong>any future week's game now</strong>—you don't need to wait for the game date or matchup week.</p>
      {stadium&&<p className="gm-stadium-home"><MapPin size={17}/> Your home Stadium: <strong>{stadium}</strong></p>}
    </div>
    {selectable&&<div className="gm-stadium-summary">
      <strong>{upcoming.length-missing} / {upcoming.length}</strong>
      <span>Upcoming home matchups with a Day/Night choice saved</span>
      {missing>0&&<b>{missing} NEED{missing===1?'S':''} A SELECTION</b>}
    </div>}
    {games.length===0?<p className="gm-stadium-empty">No home matchups have been generated yet. They'll appear here as soon as the commissioner creates the schedule.</p>:
      <div className="gm-stadium-games">{games.map(game=><MatchupSetting key={game.id} league={l} game={game} stadium={stadium} teamId={team.id}/>)}</div>}
    <p className="gm-stadium-help">Only the home-team GM can save these choices. The public Schedule automatically shows the selected version but has no edit controls. Choices lock when the game is officially locked or recorded.</p>
  </section>;
}
