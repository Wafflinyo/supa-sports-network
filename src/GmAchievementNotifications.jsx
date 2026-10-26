import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {X, Trophy, Sparkles, CheckCircle2} from 'lucide-react';
import {earnedAchievements} from './gm-achievements.js';
import {AchievementBadgeArt} from './AchievementBadgeArt.jsx';
import './gm-achievement-notifications.css';

const TABLE='ssl_gm_achievement_notices';
const validSlot=slot=>slot!==null&&slot!==undefined&&slot!==''&&Number.isFinite(Number(slot));

/** Acknowledging a notification never awards a badge. The badges themselves
 * are computed from released league results and lifetime GM achievements.
 */
export function unseenAchievements(achievements, acknowledgedIds) {
  const seen=new Set(acknowledgedIds);
  return achievements.filter(b=>b.earned&&!seen.has(b.id));
}
export function noticesForBadges(userId, achievements) {
  if(!userId)return [];
  return achievements.map(b=>({user_id:userId,badge_id:b.id}));
}

export default function GmAchievementNotifications({
  supabase,userId,slot,seasons=[],onViewAchievements,refreshLeague
}) {
  const [seen,setSeen]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [snoozed,setSnoozed]=useState(false);
  const alive=useRef(true);
  const firstButton=useRef(null);
  const fetchCounter=useRef(0);

  const awarded=useMemo(()=>validSlot(slot)?
    earnedAchievements(seasons,Number(slot)).filter(x=>x.earned):[],
    [seasons,slot]);
  const pending=useMemo(()=>unseenAchievements(awarded,seen),[awarded,seen]);
  const open=Boolean(loaded&&!snoozed&&pending.length);

  const reloadSeen=useCallback(async()=>{
    if(!supabase||!userId||!validSlot(slot))return;
    const request=++fetchCounter.current;
    const {data,error:fetchError}=await supabase.from(TABLE)
      .select('badge_id').eq('user_id',userId);
    if(!alive.current||request!==fetchCounter.current)return;
    if(fetchError){
      setError('Unable to check achievement notifications. Please try again when connected.');
      setLoaded(false);
      return;
    }
    setSeen((data||[]).map(x=>x.badge_id));
    setError('');
    setLoaded(true);
  },[supabase,userId,slot]);

  useEffect(()=>{
    alive.current=true;
    setSeen([]);
    setLoaded(false);
    setError('');
    setSnoozed(false);
    reloadSeen();
    return()=>{alive.current=false;fetchCounter.current++};
  },[reloadSeen]);

  // PWA resume, browser tab return, and returning after the phone was locked
  // all catch up immediately. The league's regular 8s polling also continues.
  useEffect(()=>{
    const resume=()=>{
      if(document.visibilityState!=='visible')return;
      reloadSeen();
      if(typeof refreshLeague==='function')refreshLeague();
    };
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('focus',resume);
    return()=>{
      document.removeEventListener('visibilitychange',resume);
      window.removeEventListener('focus',resume);
    };
  },[reloadSeen,refreshLeague]);

  useEffect(()=>{
    if(!open)return;
    firstButton.current?.focus();
    const escape=e=>{if(e.key==='Escape'&&!saving)setSnoozed(true)};
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[open,saving]);

  async function acknowledge(goToGallery=false){
    if(saving||!pending.length||!userId)return;
    setSaving(true);
    setError('');
    const ids=pending.map(b=>b.id);
    try{
      const {error:saveError}=await supabase.from(TABLE).upsert(
        noticesForBadges(userId,pending),
        {onConflict:'user_id,badge_id',ignoreDuplicates:true}
      );
      if(saveError)throw saveError;
      if(!alive.current)return;
      setSeen(previous=>[...new Set([...previous,...ids])]);
      if(goToGallery)onViewAchievements?.();
    }catch(e){
      if(alive.current)setError('Could not save these notifications. Check your connection and try again.');
    }finally{
      if(alive.current)setSaving(false);
    }
  }

  // If the database request fails, do not mistakenly mark anything as seen.
  // The next return to the app automatically retries the fetch.
  if(!open)return null;
  const multi=pending.length>1;
  return <div className="ssl-award-backdrop" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="ssl-award-title"
      aria-describedby="ssl-award-description" className="ssl-award-dialog">
      <button type="button" className="ssl-award-dismiss" aria-label="Remind me later"
        onClick={()=>setSnoozed(true)} disabled={saving}><X size={20}/></button>
      <div className="ssl-award-top">
        <div className="ssl-award-trophy"><Trophy size={26}/></div>
        <span className="ssl-award-eyebrow">SLUGGERS SUPA LEAGUE · GM TROPHY CASE</span>
        <h2 id="ssl-award-title">{multi?'ACHIEVEMENTS UNLOCKED!':'ACHIEVEMENT UNLOCKED!'}</h2>
        <p id="ssl-award-description">
          {multi?`You earned ${pending.length} new GM achievements while you were away!`:
            'You earned a new GM achievement!'}
        </p>
      </div>
      <div className="ssl-award-list" aria-label="Newly unlocked achievements">
        {pending.map(b=><article key={b.id} className="ssl-award-item">
          <div className="ssl-award-art"><AchievementBadgeArt badge={b} earned/></div>
          <div className="ssl-award-item-copy">
            <span><Sparkles size={13}/> {b.category.toUpperCase()} · UNLOCKED</span>
            <h3>{b.name}</h3>
            <p>{b.description}</p>
            {b.lastEarned?.seasonName&&<small>
              {b.lastEarned.seasonName}
              {b.lastEarned.playerName?' · '+b.lastEarned.playerName:''}
            </small>}
          </div>
          <CheckCircle2 className="ssl-award-check" aria-hidden="true" size={19}/>
        </article>)}
      </div>
      {error&&<p className="ssl-award-error" role="alert">{error}</p>}
      <div className="ssl-award-actions">
        <button type="button" className="ssl-award-later" disabled={saving}
          onClick={()=>setSnoozed(true)}>REMIND ME LATER</button>
        <button type="button" className="ssl-award-confirm" disabled={saving}
          ref={firstButton} onClick={()=>acknowledge(false)}>
          {saving?'SAVING…':'AWESOME!'}
        </button>
        <button type="button" className="ssl-award-view" disabled={saving}
          onClick={()=>acknowledge(true)}>VIEW MY BADGES</button>
      </div>
      <p className="ssl-award-note">These badges are yours for life. Acknowledged alerts won't repeat when you sign in on another device.</p>
    </section>
  </div>;
}
