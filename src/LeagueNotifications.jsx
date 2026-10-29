import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Bell,BellRing,CheckCheck,ChevronRight,Flame,Trophy,CalendarDays,ClipboardList,Newspaper,Handshake} from 'lucide-react';
import {buildLeagueAlerts} from './league-alerts.js';
import {gameLineupIsEditable} from './roster-lineups.js';
import {validLineup} from './season-data.js';
import './league-notifications.css';

function readStored(key){
  if(!key)return [];
  try {
    const result=JSON.parse(window.localStorage.getItem(key)||'[]');
    return Array.isArray(result)?result.filter(x=>typeof x==='string'):[];
  }catch {return []}
}
function AlertIcon({alert}){
  if(alert.gameId||alert.title.toLowerCase().includes('lineup'))return <ClipboardList size={20}/>;
  if(alert.id.includes(':heat:'))return <Flame size={20}/>;
  if(alert.id.includes(':news:'))return <Newspaper size={20}/>;
  if(alert.id.includes(':trades:'))return <Handshake size={20}/>;
  if(alert.id.includes('bracket'))return <Trophy size={20}/>;
  return <CalendarDays size={20}/>;
}
export default function LeagueNotifications({userId,league,newsItems=[],players=[],onNavigate}){
  const [open,setOpen]=useState(false);
  const [read,setRead]=useState([]);
  const [saving,setSaving]=useState('');
  const ref=useRef(null);
  const season=league.season;
  const key=userId&&season?.id?'ssl-league-alerts:v1:'+userId+':'+season.id:null;
  const alerts=useMemo(()=>buildLeagueAlerts({
    season,myTeam:league.myTeam,role:league.access.role,now:league.now,
    inbox:league.inbox,newsItems,players,
  }),[season,league.myTeam,league.access.role,league.now,league.inbox,newsItems,players]);
  useEffect(()=>{setRead(readStored(key));setOpen(false)},[key]);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!ref.current?.contains(e.target))setOpen(false)};
    const escape=e=>{if(e.key==='Escape')setOpen(false)};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
  },[open]);
  if(!userId || !['gm','commissioner'].includes(league.access.role))return null;
  const seen=new Set(read);
  const unread=alerts.filter(a=>!seen.has(a.id)).length;
  const markRead=(ids)=>{
    if(!key)return;
    setRead(previous=>{
      const next=[...new Set([...previous,...ids])].slice(-300);
      try{window.localStorage.setItem(key,JSON.stringify(next))}catch{}
      return next;
    });
  };
  const visit=alert=>{markRead([alert.id]);setOpen(false);onNavigate(alert.target)};
  const useDefault=async alert=>{
    const game=season?.games?.find(g=>String(g.id)===String(alert.gameId));
    const team=league.myTeam?.id;
    if(!game||!team||saving||league.busy||
      !gameLineupIsEditable(season,team,game)||
      !validLineup(season,team,season.defaults?.[team])||
      !Number.isFinite(Date.parse(game.startsAt))||Date.parse(game.startsAt)<=league.now)return;
    setSaving(alert.id);
    try{
      const ok=await league.act('game_lineup',{team,game:game.id,useDefault:true});
      if(ok)markRead([alert.id]);
    }finally{setSaving('')}
  };
  return <div className="ssl-alert-root" ref={ref}>
    <button type="button" className="ssl-alert-bell" aria-label={unread?'Notifications, '+unread+' unread':'Notifications'}
      aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(v=>!v)}>
      {unread?<BellRing size={25}/>:<Bell size={25}/>}
      {unread>0&&<span className="ssl-alert-badge" aria-hidden="true">{unread>99?'99+':unread}</span>}
    </button>
    {open&&<div className="ssl-alert-popover" role="region" aria-label="League notifications">
      <div className="ssl-alert-head">
        <div><small>SLUGGERS SUPA LEAGUE</small><h2>NOTIFICATIONS</h2><p>{unread?unread+' unread alert'+(unread===1?'':'s'):'You are caught up!'}</p></div>
        {unread>0&&<button type="button" onClick={()=>markRead(alerts.map(a=>a.id))} className="ssl-alert-read"><CheckCheck size={16}/> MARK ALL READ</button>}
      </div>
      <div className="ssl-alert-list">
        {alerts.length===0?<p className="ssl-alert-empty">No active alerts. New draft, schedule, lineup and league news updates will appear here.</p>:
        alerts.map(alert=><div className={'ssl-alert-entry '+(!seen.has(alert.id)?'is-unread ':'')+alert.type} key={alert.id}>
          <button type="button" className="ssl-alert-target" onClick={()=>visit(alert)}>
            <span className="ssl-alert-icon"><AlertIcon alert={alert}/></span>
            <span className="ssl-alert-info">
              <strong>{alert.title}</strong><small>{alert.detail}</small>
              <em>{alert.type==='task'?'ACTION NEEDED':'LEAGUE UPDATE'}</em>
            </span>
            <ChevronRight size={17} className="ssl-alert-chevron"/>
          </button>
          {alert.gameId&&<div className="ssl-alert-action">
            <button type="button" disabled={!alert.canUseDefault||league.busy||!!saving}
              onClick={()=>useDefault(alert)}>
              {saving===alert.id?'SUBMITTING…':'USE DEFAULT LINEUP'}
            </button>
            {!alert.canUseDefault&&<small>Save your default lineup first.</small>}
          </div>}
        </div>)}
      </div>
      <div className="ssl-alert-foot">Alerts update with the league. Read status is saved on this device.</div>
    </div>}
  </div>;
}
