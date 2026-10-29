import {DraftPlayers, DraftPickBoard} from './DraftPlayers.jsx';
import {PowerRankings,PreseasonTournament} from './SeasonPreseason.jsx';
import {preseasonReady} from './preseason.js';
import {lotteryProgress,lotteryReplayProgress,lotteryDuration,lotteryCountdownClock} from './lottery-timing.js';
import {orderedDraftPickTeams,lotteryOrderReady,teamsInLotteryOrder} from './draft-pick-stats-order.js';
import DraftOrderBoard from './DraftOrderBoard.jsx';
import {BingoLottery} from './BingoLottery.jsx';
import {matchupDisplay} from './matchup-display.js';
import {supportsStadiumVariant,matchupStadiumVariant} from './stadium-lighting.js';
import DraftChat from './DraftChat.jsx';
import {heatingUpForSeason,HEATING_UP_THRESHOLD} from './heating-up.js';
import {effectiveGameLineup,gameLineupIsEditable,teamGameLineups,savedLineupLabel} from './roster-lineups.js';
import {
  SeasonRuleControls,
  PublicBallots,
  BroadcastControls,
  PlayoffPanel,
  conferences,
} from "./SeasonRules.jsx";
import ContractExtensions from "./ContractExtensions.jsx";
import {
  SeasonCalendar,
  ScheduleGenerator,
} from "./SeasonCalendar.jsx";
import React, { useState, useEffect, useMemo, useRef } from "react";
import pool from "./players.json";
import { teamLogo } from "./TeamIdentity.jsx";
import { ConferenceMark } from './ConferenceMark.jsx';
import { PlayerPortrait } from "./PlayerPortrait.jsx";
import {PlayerProfileLink} from './PlayerProfileLink.jsx';
import {HeatMark} from './HeatingUpBadge.jsx';
import {opponentScouting} from './league-alerts.js';
import playerData from "./player-data.json";
import { pitcherPriorityText } from "./player-roles.js";
import { PitcherPriorityBadge } from './PlayerData.jsx';
import {taggedName} from './PlayerPriority.jsx';
import {
  rosterOf,
  validLineup,
  positions,
  elapsed,
  clock,
  standings,
  matchupType,
  aggregate,
  readRio,
  buildReport,
  previewCustomGameScore,
} from "./season-data.js";
import "./season.css";
const byPlayer = new Map(pool.map((p) => [p.id, p]));
const pitcherTag = (id) => pitcherPriorityText(byPlayer.get(Number(id)), playerData.players[Number(id)]);
const time = (v) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(new Date(v)) + " ET"
    : "Not set";
const iso = (v) => new Date(v).toISOString();
const name = (id) => byPlayer.has(Number(id)) ? taggedName(byPlayer.get(Number(id))) : "Unknown player";
function Player({ id, seasons=[] }) {
  const p = byPlayer.get(Number(id));
  return <PlayerProfileLink player={p} className="portrait-label">
    <PlayerPortrait player={p} />
    {p?.name || 'Unknown player'}
    {p&&<PitcherPriorityBadge player={p} record={playerData.players[p.id]}/>}
  </PlayerProfileLink>;
}
function Title({ children, detail }) {
  return (
    <div className="page-heading">
      <span className="eyebrow dark">SLUGGERS SUPA LEAGUE</span>
      <h1>{children}</h1>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function Box({ title, children }) {
  return (
    <section className="panel season-box">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function useSeasonLeague(supabase, access) {
  const [seasons, setSeasons] = useState([]),
    [selected, setSelected] = useState(null),
    [inbox, setInbox] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [ballotVoters, setBallotVoters] = useState(null),
    [ballotVotersError, setBallotVotersError] = useState(""),
    [now, setNow] = useState(Date.now());
  const serverOffsetMs = useRef(0);
  const season = seasons.find((s) => s.id === selected) || seasons[0] || null;
  async function refresh() {
    if (!supabase) return;
    const r = await supabase.rpc("ssl_seasons");
    if (r.error) {
      setError(r.error.message);
      return;
    }
    // Keep the lottery timeline identical on devices whose local clocks differ.
    const serverTime = Date.parse((r.data || [])[0]?.serverNow || '');
    if (Number.isFinite(serverTime)) {
      serverOffsetMs.current = serverTime - Date.now();
      setNow(Date.now() + serverOffsetMs.current);
    }
    // Public, separate exhibition results; NEVER change the live draft season state.
    const rawSeasons = Array.isArray(r.data) ? r.data : [];
    const ids=rawSeasons.map(s=>s.id).filter(Boolean);
    let bySeason=new Map();
    if(ids.length){
      const tournament=await supabase.from('ssl_preseason_results')
        .select('season_id,match_key,team_a,team_b,score_a,score_b,recorded_at')
        .in('season_id',ids);
      if(!tournament.error){
        for(const result of tournament.data||[]){
          const rows=bySeason.get(result.season_id)||[];
          rows.push(result);
          bySeason.set(result.season_id,rows);
        }
      }
    }
    setSeasons(rawSeasons.map(s=>({...s,preseasonResults:bySeason.get(s.id)||[]})));
    setError("");
    // Secure, commissioner-only roster. No account identities enter the public
    // season response; the server verifies current commissioner access.
    const targetSeason = selected || (r.data || [])[0]?.id;
    if (access.role === "commissioner" && targetSeason) {
      const v = await supabase.rpc("ssl_commissioner_ballot_voters", {target_season: targetSeason});
      if (v.error) {
        setBallotVoters(null);
        setBallotVotersError(v.error.message);
      } else {
        setBallotVoters(v.data || {});
        setBallotVotersError("");
      }
    } else {
      setBallotVoters(null);
      setBallotVotersError("");
    }
    if (
      ["gm", "commissioner"].includes(access.role) &&
      (selected || (r.data || [])[0]?.id)
    ) {
      const m = await supabase.rpc("ssl_inbox", {
        season: selected || (r.data || [])[0].id,
      });
      if (m.error) setError(m.error.message);
      else setInbox(m.data || []);
    } else setInbox([]);
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [supabase, access.role, access.slot, selected]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + serverOffsetMs.current), 1000);
    return () => clearInterval(t);
  }, []);
  async function act(operation, payload = {}) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await supabase.rpc("ssl_manage", {
        operation,
        season: season?.id || null,
        payload,
      });
      if (r.error) throw r.error;
      if (operation === "create") setSelected(r.data.id);
      await refresh();
      setNotice(
        operation === "result"
          ? "Report saved privately. Lineups are locked; results release after the premiere."
          : operation === "add_player"
            ? "Player successfully added. Update your default lineup."
            : "Saved.",
      );
      return r.data || true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function recordPreseasonResult(matchKey,scoreA,scoreB){
    if(busy||!season||access.role!=='commissioner')return false;
    setBusy(true);setError('');setNotice('');
    try{
      const r=await supabase.rpc('ssl_preseason_record',{
        target_season:season.id,target_match:matchKey,a_score:scoreA,b_score:scoreB
      });
      if(r.error)throw r.error;
      await refresh();setNotice('Preseason tournament result saved. The bracket has been reseeded.');
      return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function clearPreseasonResult(matchKey){
    if(busy||!season||access.role!=='commissioner')return false;
    setBusy(true);setError('');setNotice('');
    try{
      const r=await supabase.rpc('ssl_preseason_clear',{target_season:season.id,target_match:matchKey});
      if(r.error)throw r.error;
      await refresh();setNotice('Preseason result cleared.');
      return true;
    }catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  const myTeam = season?.teams?.find((t) => t.slot === Number(access.slot));
  return {
    seasons,
    season,
    selected,
    setSelected,
    inbox,
    error,
    notice,
    busy,
    ballotVoters,
    ballotVotersError,
    now,
    act,
    refresh,
    recordPreseasonResult,
    clearPreseasonResult,
    access,
    myTeam,
    supabase,
  };
}
export function SeasonSelector({ league }) {
  const { seasons, season, setSelected } = league;
  return seasons.length ? (
    <div className="season-selector">
      <label>
        SSL SEASON{" "}
        <select
          aria-label="SSL season"
          value={season?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.status}
            </option>
          ))}
        </select>
      </label>
    </div>
  ) : null;
}
export function SeasonFeedback({ league }) {
  return (
    <>
      {league.error && (
        <p className="inline-message season-error" role="alert">
          {league.error}
        </p>
      )}
      {league.notice && (
        <p className="season-saved" role="status">
          {league.notice}
        </p>
      )}
    </>
  );
}
export function SeasonPrompts({ league, go }) {
  const { s: unused, ...l } = league,
    s = l.season,
    t = l.myTeam;
  if (!s || !t || !["gm", "commissioner"].includes(l.access.role)) return null;
  const under =
      rosterOf(s, t.id).length < 11 &&
      ["postdraft", "regular", "postseason", "retention"].includes(s.status),
    needs =
      ["postdraft", "regular", "postseason", "retention"].includes(s.status) &&
      s.needsDefault?.includes(t.id),
    upcoming =
      s.schedulePublished &&
      s.games
        .filter(
          (g) => g.stage === "scheduled" && [g.away, g.home].includes(t.id),
        )
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
        .find((g) => !validLineup(s, t.id, g.lineups?.[t.id]));
  const pending = l.inbox.filter(
    (o) =>
      ["pending", "ready"].includes(o.status) && !o.accepted.includes(t.id),
  ).length;
  if (!under && !needs && !upcoming && !pending) return null;
  return (
    <aside className="season-prompt" aria-label="Team actions required">
      <strong>{t.name}: ACTIONS NEEDED</strong>
      {under ? (
        <>
          <p>
            Your roster has {rosterOf(s, t.id).length} players. Add free agents
            or randomly fill to 11 before updating your lineup.
          </p>
          <button className="red-btn" onClick={() => go("Free Agency")}>
            PICK UP PLAYERS
          </button>
          <button
            className="outline-btn"
            disabled={l.busy}
            onClick={() => l.act("random_fill", { team: t.id })}
          >
            RANDOM FILL TO 11
          </button>
        </>
      ) : needs ? (
        <>
          <p>Update your default lineup after the draft or roster change.</p>
          <button className="red-btn" onClick={() => go(l.access.role === "commissioner" ? "Commissioner Tools" : "GM Tools", "Roster")}>
            SET DEFAULT LINEUP
          </button>
        </>
      ) : upcoming ? (
        <>
          <p>
            Submit a lineup for your upcoming game on {time(upcoming.startsAt)},
            or choose your default.
          </p>
          <button className="red-btn" onClick={() => go(l.access.role === "commissioner" ? "Schedule" : "GM Tools", "Roster")}>
            GAME LINEUP
          </button>
        </>
      ) : null}
      {pending > 0 && (
        <button className="outline-btn" onClick={() => go("Messages")}>
          {pending} TRADE OFFER{pending === 1 ? "" : "S"} NEED A RESPONSE
        </button>
      )}
    </aside>
  );
}
export function SeasonWorkspace({ league, registeredTeams }) {
  const l = league,
    s = l.season,
    [newName, setNewName] = useState(""),
    [slots, setSlots] = useState([]),
    [draft, setDraft] = useState(""),
    [lotteryMins, setLotteryMins] = useState(20),
    [finish, setFinish] = useState({ champion: "", finalist: "" }),
    [tab, setTab] = useState("Season Setup");
  useEffect(
    () => setSlots(s?.teams?.map((t) => t.slot) || []),
    [s?.id, s?.teams?.length],
  );
  // Commissioner scheduling follows the current persisted league draft date.
  // The local input is prefilled for convenient adjustments, but is never
  // itself authoritative for the public Draft Room banner.
  useEffect(()=>{
    if (!s?.draftAt) {setDraft("");return;}
    const date=new Date(s.draftAt);
    if(!Number.isFinite(date.getTime()))return;
    const localDate=new Date(date.getTime()-date.getTimezoneOffset()*60000);
    setDraft(localDate.toISOString().slice(0,16));
    // Retain the saved lottery lead time when editing an existing date.
    const lottery=Date.parse(s.lotteryAt);
    if(Number.isFinite(lottery)){
      const minutes=Math.round((date.getTime()-lottery)/60000);
      if(minutes>=15&&minutes<=30)setLotteryMins(minutes);
    }
  },[s?.id,s?.draftAt,s?.lotteryAt]);
  const tabs = [
    "Season Setup",
    "Draft",
    "Schedule & Results",
    "Team Rosters",
    "Trades",
    "Extensions",
  ];
  return (
    <>
      <div className="subnav">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <SeasonSelector league={l} />
      <SeasonFeedback league={l} />
      {tab === "Season Setup" && (
        <>
          <SeasonRuleControls league={l} />
          <Box title="SET UP A SEASON">
            <p>
              Creates the next season in preparation. Games do not start until
              you explicitly start the regular season.
            </p>
            <form
              className="season-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await l.act("create", {
                    name: newName || "S" + ((l.seasons[0]?.number || 0) + 1),
                  })
                )
                  setNewName("");
              }}
            >
              <label>
                Season name
                <input
                  maxLength={60}
                  value={newName}
                  placeholder={"S" + ((l.seasons[0]?.number || 0) + 1)}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <button
                className="red-btn"
                disabled={
                  l.busy ||
                  l.seasons.some(
                    (s) => !["offseason", "archived"].includes(s.status),
                  )
                }
              >
                SET UP SEASON
              </button>
            </form>
          </Box>
          {s && (
            <>
              <Box title={`${s.name} · ${s.status.toUpperCase()}`}>
                <p>
                  Registered teams are managed in Team Setup. All 12 need a team name, home location, logo, and conference selection before you can schedule the draft.
                </p>
                <p role="status"><strong>{registeredTeams.length}/12 teams registered.</strong> {registeredTeams.length < 12 ? `Waiting on ${12-registeredTeams.length} more team${12-registeredTeams.length===1?'':'s'} before the commissioner can schedule the draft.` : 'All teams registered! Select all twelve and schedule the draft directly below.'}</p>
                {["setup", "poll"].includes(s.status) ? (
                  <>
                    <div className="season-team-checks">
                      {registeredTeams.map((t) => (
                        <label key={t.slot}>
                          <input
                            type="checkbox"
                            checked={slots.includes(t.slot)}
                            onChange={() =>
                              setSlots((x) =>
                                x.includes(t.slot)
                                  ? x.filter((i) => i !== t.slot)
                                  : [...x, t.slot],
                              )
                            }
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                    <p>{slots.length}/12 selected · Supa: {registeredTeams.filter(t=>slots.includes(t.slot)&&t.conference==='supa').length}/6 · Galaxy: {registeredTeams.filter(t=>slots.includes(t.slot)&&t.conference==='galaxy').length}/6</p>
                    <button
                      className="red-btn"
                      disabled={l.busy}
                      onClick={() => l.act("teams", { slots })}
                    >
                      SAVE SEASON TEAMS
                    </button>
                  </>
                ) : (
                  <p>
                    {s.teams.length} teams · {s.baseDraftRounds || 12}-round
                    snake draft
                  </p>
                )}
              </Box>
              {["setup", "poll", "scheduled"].includes(s.status) && (
                <Box title="OFFICIAL DRAFT DATE & TIME">
                  <p>Only the commissioner chooses or changes the draft time. No franchise voting or poll is required.</p>
                  {s.draftAt && <p className="ssl-commissioner-scheduled-date">CURRENTLY SCHEDULED: <strong>{time(s.draftAt)}</strong></p>}
                  <form className="season-form" onSubmit={(e)=>{
                    e.preventDefault();
                    if(!draft)return;
                    l.act("schedule_draft",{
                      draftAt:iso(draft),
                      lotteryAt:new Date(new Date(draft).getTime()-lotteryMins*60000).toISOString(),
                    });
                  }}>
                    <label>
                      Official draft date and time
                      <input type="datetime-local" required value={draft} onChange={e=>setDraft(e.target.value)}/>
                    </label>
                    <label>
                      Lottery minutes before draft
                      <input type="number" min={15} max={30} required value={lotteryMins}
                        onChange={e=>setLotteryMins(Number(e.target.value))}/>
                    </label>
                    <button className="red-btn" disabled={l.busy || !draft || s.teams.length!==12 || !s.conferencesSet}>
                      {s.draftAt ? "UPDATE DRAFT DATE" : "SET DRAFT DATE"}
                    </button>
                    <p>The Draft Room displays your saved date and a countdown. Entry opens one hour before draft time; the lottery runs at its scheduled start and its official draw is never rerolled on refresh.</p>
                  </form>
                </Box>
              )}
              {s.status === "postdraft" && (
                <Box title="OPENING DAY">
                  <p>
                    Finish all default lineups, enter and publish the schedule,
                    then start the regular season.
                  </p>
                  <button
                    className="red-btn"
                    disabled={l.busy}
                    onClick={() => l.act("start_season")}
                  >
                    START REGULAR SEASON
                  </button>
                </Box>
              )}
              {s.status === "regular" && (
                <Box title="POSTSEASON">
                  <p>
                    All regular-season games must have results first. Enter
                    playoff games in Schedule & Results after opening the
                    postseason.
                  </p>
                  <button
                    className="red-btn"
                    disabled={l.busy}
                    onClick={() => l.act("postseason")}
                  >
                    OPEN POSTSEASON
                  </button>
                </Box>
              )}
              {s.status === "postseason" && (
                <Box title="FINISH CHAMPIONSHIP SERIES">
                  <p>
                    Confirm only after the final championship game. This opens
                    the one-month extension window for player and Stadium
                    contracts. Each team shares three contracts across both.
                  </p>
                  <form
                    className="season-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      l.act("finish", {
                        ...finish,
                        endedAt: finish.endedAt
                          ? iso(finish.endedAt)
                          : undefined,
                      });
                    }}
                  >
                    {["champion", "finalist"].map((k) => (
                      <label key={k}>
                        {k === "champion" ? "Champion" : "Runner-up"}
                        <select
                          required
                          value={finish[k]}
                          onChange={(e) =>
                            setFinish({ ...finish, [k]: e.target.value })
                          }
                        >
                          <option value="">Choose team</option>
                          {teamsInLotteryOrder(s,s?.serverNow).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label>
                      Championship series end time (optional; defaults to latest
                      result posting)
                      <input
                        type="datetime-local"
                        value={finish.endedAt || ""}
                        onChange={(e) =>
                          setFinish({ ...finish, endedAt: e.target.value })
                        }
                      />
                    </label>
                    <button className="red-btn" disabled={l.busy}>
                      CONFIRM CHAMPIONSHIP END
                    </button>
                  </form>
                </Box>
              )}
              {["retention", "offseason"].includes(s.status) && (
                <SeasonCalendar league={l} />
              )}
            </>
          )}
        </>
      )}
      {tab === "Draft" && <Draft league={l} />}
      {tab === "Schedule & Results" && <Schedule league={l} commissioner />}
      {tab === "Team Rosters" && <RosterManager league={l} />}
      {tab === "Trades" && <Trades league={l} />}
      {tab === "Extensions" && <Extensions league={l} />}
    </>
  );
}
function TeamChooser({ s, value, onChange, label = "Team" }) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose team</option>
        {teamsInLotteryOrder(s,s?.serverNow).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function useActingTeam(l) {
  const [t, setT] = useState("");
  useEffect(() => setT(l.myTeam?.id || ""), [l.season?.id, l.myTeam?.id]);
  return [l.access.role === "commissioner" ? t : l.myTeam?.id, setT];
}
function draftCountdown(startsAt,now){
  const stamp=Date.parse(startsAt);
  if(!Number.isFinite(stamp))return null;
  const ms=Math.max(0,stamp-now);
  const seconds=Math.ceil(ms/1000);
  const days=Math.floor(seconds/86400);
  const hours=Math.floor((seconds%86400)/3600);
  const minutes=Math.floor((seconds%3600)/60);
  const secs=seconds%60;
  return {days,hours,minutes,seconds:secs,remaining:ms,
    display:[days?String(days)+'d':null,String(hours).padStart(2,'0'),String(minutes).padStart(2,'0'),String(secs).padStart(2,'0')].filter(Boolean).join(':')};
}
function DraftRoomEntrance({season,now,open,entered,onEnter,onLeave}){
  const remaining=draftCountdown(season?.draftAt,now);
  const lotteryStatus=lotteryProgress(season?.order?.length||0,season?.lotteryAt,now);
  const lotterySoon=['countdown','curtain-opening','final-countdown'].includes(lotteryStatus.phase);
  const lotteryDate=season?.lotteryAt;
  const hasDate=Boolean(season?.draftAt && remaining);
  const finished=Boolean(season && ['postdraft','regular','postseason','retention','offseason','archived'].includes(season.status));
  const started=hasDate&&remaining.remaining===0;
  const status=!hasDate?'DATE NOT SCHEDULED':finished?'DRAFT COMPLETED':started?'DRAFT IN PROGRESS':'COUNTDOWN TO THE DRAFT';
  return <section className={'ssl-draft-room-gateway'+(entered?' ssl-gateway-inside':'')} aria-label="Official draft date and entry">
    <div className="ssl-draft-room-header">
      <span className="ssl-draft-room-kicker">SLUGGERS SUPA LEAGUE · OFFICIAL DRAFT ROOM</span>
      <h2>{status}</h2>
      <time className="ssl-draft-date-large" dateTime={season?.draftAt||undefined}>
        {hasDate?time(season.draftAt):'DATE AND TIME TO BE ANNOUNCED'}
      </time>
      {!entered&&<p>{open
        ? 'The Draft Room is open. Enter to view the live lottery, draft board and commissioner/GM chat.'
        : hasDate
          ? 'The room opens one hour before the scheduled draft. The live draft and chat are available after you enter.'
          : 'The commissioner will set the official draft date and time in Commissioner Tools.'}</p>}
    </div>
    <div className="ssl-draft-clock-section">
      {lotterySoon&&<div className="ssl-lottery-lobby-alert" role="status">
        <strong>LOTTERY STARTING SOON!</strong>
        <span>{lotteryStatus.phase==='countdown'
          ? lotteryCountdownClock(lotteryStatus.secondsToNext)+' TO LOTTERY TIME'
          :lotteryStatus.phase==='curtain-opening'?'CURTAINS OPENING…'
            :'3–2–1 · LOTTERY ABOUT TO BEGIN'}</span>
        {!entered&&<small>ENTER DRAFT ROOM TO WATCH THE LIVE SHOW</small>}
      </div>}
      {!lotterySoon&&lotteryDate&&!entered&&<span className="ssl-lottery-lobby-date">
        LOTTERY SHOW · {time(lotteryDate)}
      </span>}
      {hasDate&&remaining.remaining>0
        ? <><span className="ssl-draft-clock-caption">DRAFT BEGINS IN</span><strong className="ssl-draft-clock-count" role="timer">{remaining.display}</strong></>
        : <strong className="ssl-draft-clock-status">{finished?'DRAFT FINISHED':started?'DRAFT TIME':'AWAITING DATE'}</strong>}
      {!entered
        ? <button className="ssl-enter-draft-button" type="button" disabled={!open} onClick={onEnter}>
            {open?'ENTER DRAFT ROOM':'DRAFT ROOM LOCKED'}
          </button>
        : <button className="ssl-leave-draft-button" type="button" onClick={onLeave}>LEAVE DRAFT ROOM</button>}
    </div>
  </section>;
}
function Draft({ league: l }) {
  const s = l.season;
  const [enteredRoom,setEnteredRoom] = useState(false);
  useEffect(()=>{setEnteredRoom(false);},[s?.id]);
  // The official lottery is always derived from the shared server clock.
  // Arriving mid-draw joins the current ball, never starts a new simulation.
  const liveLottery = lotteryProgress(s?.order?.length || 0, s?.lotteryAt, l.now);
  // The scheduled lottery draw is performed server-side at lotteryAt. During
  // the opening ceremony, synchronize sooner than the normal 8-second poll
  // so everyone gets the real persisted ball order before the cage mixes.
  const needsDrawSync=Boolean(s?.id&&s?.lotteryAt&&!s?.order?.length&&
    Date.parse(s.lotteryAt)-l.now<=6000&&Date.parse(s.lotteryAt)-l.now>=-30000);
  useEffect(()=>{
    if(!needsDrawSync)return;
    l.refresh();
    const timer=setInterval(()=>l.refresh(),2500);
    return()=>clearInterval(timer);
  },[needsDrawSync,s?.id]);
  const [localReplay,setLocalReplay] = useState(null);
  const [replayElapsed,setReplayElapsed] = useState(0);
  const lotteryDetailsRef = useRef(null);
  const orderKey = (s?.order || []).join('|');
  // Replay is LOCAL only; it reads the persisted official order. No write,
  // draw, RNG, RPC or broadcast occurs when a user presses this button.
  const isReplaying = Boolean(localReplay && localReplay.seasonId === s?.id &&
    localReplay.lotteryAt === s?.lotteryAt && localReplay.orderKey === orderKey);
  const replayDuration = lotteryDuration(s?.order?.length || 0);
  useEffect(()=>{
    if(!isReplaying)return;
    const tick=()=>setReplayElapsed(Math.min(replayDuration,
      Math.max(0,performance.now()-localReplay.startPerf)));
    tick();
    const interval=setInterval(tick,75);
    return()=>clearInterval(interval);
  },[isReplaying,localReplay?.startPerf,replayDuration]);
  const lottery = isReplaying
    ? lotteryReplayProgress(s.order.length,replayElapsed)
    : liveLottery;
  const canReplay = s?.order?.length > 0 && liveLottery.phase === 'complete';
  const replayFinished = isReplaying && replayElapsed >= replayDuration;
  useEffect(()=>{
    if(!enteredRoom||!lotteryDetailsRef.current)return;
    if(['countdown','curtain-opening','final-countdown'].includes(liveLottery.phase))
      lotteryDetailsRef.current.open=true;
  },[enteredRoom,liveLottery.phase]);
  const beginReplay=()=>{
    if(!canReplay)return;
    if(lotteryDetailsRef.current)lotteryDetailsRef.current.open=true;
    setReplayElapsed(0);
    setLocalReplay({seasonId:s.id,lotteryAt:s.lotteryAt,orderKey,
      startPerf:performance.now()});
  };
  const stopReplay=()=>{setLocalReplay(null);setReplayElapsed(0);};
  const reveal = lottery.revealed;
  const resultsShown = lottery.phase === 'rolling' ? Math.max(0,reveal-1) : reveal;
  const drawRevealed=lotteryOrderReady(s,l.now); // Always use LIVE time; never the private replay time.
  const pickTimeTeams=orderedDraftPickTeams(s,l.now);
  // The pick clock and order are server-owned; this listener only catches a
  // returning GM up immediately instead of waiting for the 8s regular poll.
  useEffect(()=>{
    if(!s?.id)return;
    const catchUp=()=>{if(document.visibilityState==='visible' && typeof l.refresh==='function')l.refresh();};
    catchUp();
    document.addEventListener('visibilitychange',catchUp);
    window.addEventListener('focus',catchUp);
    return ()=>{
      document.removeEventListener('visibilitychange',catchUp);
      window.removeEventListener('focus',catchUp);
    };
  },[s?.id]);
  if (!s)
    return <section className="panel season-box">
      <h2>DRAFT DATE TO BE ANNOUNCED</h2>
      <p>The commissioner will set the season and official draft date in Commissioner Tools.</p>
    </section>;
  const open = ['drafting','postdraft','regular','postseason','retention','offseason','archived'].includes(s.status) ||
    (s.draftAt && l.now >= new Date(s.draftAt).getTime() - 3600000),
    next = s.picks.length,
    owner = s.nextPick?.team,
    t = s.teams.find((t) => t.id === owner),
    mine = l.access.role === "commissioner" || l.myTeam?.id === owner;
  // The tab is only a waiting/entry page. No chat, picks or live lottery
  // are shown until the user explicitly enters during the open window.
  if(!open || !enteredRoom)return <DraftRoomEntrance season={s} now={l.now}
    open={Boolean(open)} entered={false} onEnter={()=>setEnteredRoom(true)}/>;
  return (
    <>
      <DraftRoomEntrance season={s} now={l.now} open={Boolean(open)}
        entered onLeave={()=>{setEnteredRoom(false);stopReplay();}}/>
      <DraftChat supabase={l.supabase} season={s} access={l.access}/>
      {s.status === 'drafting' && <div className="ssl-draft-rejoin" role="status">
        <div><strong>LIVE DRAFT · LEAVE AND REENTER ANYTIME</strong>
          <p>Your picks and the current turn are saved on the league server. There is no automatic pick timer. Return through Draft Room whenever your next pick comes up; the room reconnects to the latest selection.</p>
        </div>
        <button type="button" disabled={l.busy} onClick={()=>l.refresh()}>SYNC LIVE DRAFT</button>
      </div>}
      <Box
        title={
          s.status === "drafting"
            ? `ON THE CLOCK: ${t?.name || ""}`
            : [
                  "postdraft",
                  "regular",
                  "postseason",
                  "retention",
                  "offseason",
                  "archived",
                ].includes(s.status)
              ? "DRAFT SUMMARY"
              : "DRAFT LOTTERY"
        }
      >
        <p>
          Draft begins {time(s.draftAt)} · lottery {time(s.lotteryAt)} ·{" "}
          {s.baseDraftRounds || 12} rounds · snake order (11 tradable player turns + one nontradable Stadium Pick unless the team retained its Stadium). Supplemental rounds
          fill teams below 11, skipping full teams.
        </p>
        {s.number===1&&<p className="ssl-lottery-fairness"><strong>Season 1: Equal odds for all 12 franchises.</strong> Every team begins with a 1-in-12 (8.3333%) chance of being drawn first. A drawn ball is removed, so each remaining team then has a 1-in-11 (9.0909%) chance for second. No franchise appears twice.</p>}
        {s.number>1 && <p>Returning-season lottery: 12th seed 55% · 11th 25% · 10th 15% · 9th 5% for first pick. Winners are removed before the next weighted draw. Seeds 8 through 1 receive picks 5 through 12, then the order snakes.</p>}
        {Boolean(s.lotteryAt) && <div className="ssl-lottery-playback-controls" aria-label="Official lottery playback">
          {!canReplay
            ? <div className="ssl-lottery-live-indicator"><span className="ssl-lottery-live-dot"/> {['waiting','countdown'].includes(liveLottery.phase)?'OFFICIAL LOTTERY PRE-SHOW · CURTAINS CLOSED': 'LIVE OFFICIAL LOTTERY'} · Synchronized to the server clock.</div>
            : <>
              <div className="ssl-lottery-playback-description">
                <strong>{isReplaying?'PERSONAL LOTTERY REPLAY':'OFFICIAL LOTTERY COMPLETE'}</strong>
                <span>{isReplaying
                  ? 'Watching the original saved draw from the beginning. This replay is visible only to you; everyone else stays on the official live results.'
                  : 'All 12 balls have been drawn. Replay the exact same result from the beginning on your own screen.'}</span>
              </div>
              <div className="ssl-lottery-playback-buttons">
                <button type="button" className="ssl-lottery-replay-button" onClick={beginReplay}>
                  {replayFinished?'REPLAY LOTTERY AGAIN':'REPLAY LOTTERY'}
                </button>
                {isReplaying&&<button type="button" className="ssl-lottery-return-button" onClick={stopReplay}>RETURN TO OFFICIAL RESULTS</button>}
              </div>
            </>}
        </div>}
        <details ref={lotteryDetailsRef} className="draft-order-details" defaultOpen={Boolean(s.order.length)>0 || ['scheduled','drafting'].includes(s.status)}>
          <summary>DRAFT ORDER · {s.order.length || 12} TEAMS</summary>
          {!s.lotteryAt||!s.teams?.length ? <p>Waiting for the commissioner to schedule the official lottery.</p> : <>
            <BingoLottery
              teams={s.teams}
              order={s.order}
              lottery={lottery}
              logoFor={path=>teamLogo(l.supabase,path)}
            />
            <div className="season-draft-order" aria-label="Official lottery order already announced">
              {s.order.slice(0,resultsShown).map((id,i)=>{
                const team=s.teams.find(t=>t.id===id);
                return <span key={id} className="lottery-result-team">
                  {team?.logoPath&&<img alt="" src={teamLogo(l.supabase,team.logoPath)}/>}
                  {i+1}. {team?.name}
                </span>;
              })}
            </div>
          </>}
        </details>
        {drawRevealed&&<DraftOrderBoard league={l}/>}
        {s.status === "drafting" && (
          <>
            <div className="pick-clock" aria-live="off">
              {clock(elapsed(s, l.now))}
              <small>{s.paused ? "TIMER PAUSED · PICKS STILL OPEN" : "PICK TIMER RUNNING · NO PICK DEADLINE"}</small>
            </div>
            <p>
              Round {s.nextPick?.round} · Pick {next + 1}
              {s.nextPick?.supplemental
                ? " · ROSTER FILL"
                : ` / ${12 * (s.baseDraftRounds || 12) - Object.values(s.retainedStadiums || {}).filter(v => v?.length).length} main-round picks${s.nextPick?.mustStage ? ' · STADIUM PICK REQUIRED' : ''}`}
            </p>
            {!mine && <p>Waiting for {t?.name} to pick. Browse the player pool below.</p>}
            {l.access.role === "commissioner" && (
              <button
                className="outline-btn"
                disabled={l.busy}
                onClick={() => l.act("pause")}
              >
                {s.paused ? "RESUME" : "PAUSE"} TIMER
              </button>
            )}
          </>
        )}
        {l.access.role === "commissioner" &&
          s.picks.length > 0 &&
          !s.tradingOpen &&
          ["drafting", "postdraft"].includes(s.status) && (
            <button
              className="outline-btn"
              disabled={l.busy}
              onClick={() => {
                if (confirm("Undo the last pick so it can be corrected?"))
                  l.act("undo_pick");
              }}
            >
              CORRECT LAST PICK
            </button>
          )}
        {[
          "postdraft",
          "regular",
          "postseason",
          "retention",
          "offseason",
          "archived",
        ].includes(s.status) && (
          <p>
            Draft complete. Review each roster below, then open GM Tools to
            save your starting nine, batting order, positions and bench.
          </p>
        )}
        <DraftPlayers league={l} />
      </Box>
      <DraftPickBoard season={s} />
      <Box title="PICK TIMES & RESULTS">
        <p className="ssl-lottery-pick-times-note">{drawRevealed
          ? 'Teams are ranked by their official Round 1 lottery positions. Pick counts and average times update live.'
          : 'The team list will reorder to the official lottery result once the final ball has been announced.'}</p>
        <div className="season-table">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Picks</th>
                <th>Average pick time</th>
              </tr>
            </thead>
            <tbody>
              {pickTimeTeams.map(({team:t,lotteryPosition}) => {
                const p = s.picks.filter((p) => p.team === t.id);
                return (
                  <tr key={t.id}>
                    <td>{lotteryPosition&&<span className="ssl-lottery-ordinal" aria-label={'Lottery position '+lotteryPosition}>{lotteryPosition}</span>}{t.name}</td>
                    <td>{p.length}</td>
                    <td>
                      {p.length
                        ? clock(
                            p.reduce((n, p) => n + Number(p.seconds), 0) /
                              p.length,
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </Box>
      <Teams league={l} />
    </>
  );
}

function HeatingStatus({season,game,team,includeRecorded=false}) {
  const ids=heatingUpForSeason(season,{includeRecorded}).byGame[game.id]?.[team]||[];
  return <p className="heating-up-status"><strong>★ HEATING UP · Next-game stars:</strong> {ids.length?ids.map(name).join(' · '):'None earned yet'} <small>Automatic from previous game scores of {HEATING_UP_THRESHOLD}+.</small></p>;
}
function LineupEditor({ league: l, team, game, onDone }) {
  const s = l.season,
    initial = game?.lineups?.[team] || s.defaults?.[team],
    roster = rosterOf(s, team),
    [slots, setSlots] = useState(
      positions.map(
        (pos, i) => initial?.starters?.[i] || { player: "", position: pos },
      ),
    );
  useEffect(
    () =>
      setSlots(
        positions.map(
          (pos, i) => initial?.starters?.[i] || { player: "", position: pos },
        ),
      ),
    [team, game?.id, JSON.stringify(initial)],
  );
  const lineup = {
      starters: slots.map((x) => ({ ...x, player: Number(x.player) })),
      bench: roster.filter((p) => !slots.some((x) => Number(x.player) === p)),
    },
    valid = validLineup(s, team, lineup);
  return (
    <form
      className="season-lineup"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await l.act(game ? "game_lineup" : "default_lineup", {
            team,
            game: game?.id,
            lineup,
          })
        )
          onDone?.();
      }}
    >
      <h3>{game ? "GAME LINEUP" : "DEFAULT LINEUP"}</h3>
      <p>Rows are the batting order. Assign every fielding position once.</p>
      <p className="priority-lineup-help"><strong>Pitcher change priority:</strong> P1P captains first, eligible P2P pitchers next, otherwise random. This is an SSL planning guide; this website does not change Dolphin AI.</p>
      {slots.map((x, i) => (
        <div className="lineup-row" key={i}>
          <b>{i + 1}</b>
          <select
            aria-label={`Batter ${i + 1}`}
            required
            value={x.player}
            onChange={(e) =>
              setSlots((a) =>
                a.map((v, j) =>
                  j === i ? { ...v, player: Number(e.target.value) } : v,
                ),
              )
            }
          >
            <option value="">Choose player</option>
            {roster.map((p) => (
              <option key={p} value={p}>
                {name(p)}
              </option>
            ))}
          </select>
          <select
            aria-label={`Position ${i + 1}`}
            value={x.position}
            onChange={(e) =>
              setSlots((a) =>
                a.map((v, j) =>
                  j === i ? { ...v, position: e.target.value } : v,
                ),
              )
            }
          >
            {positions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      ))}
      {game ? <HeatingStatus season={s} game={game} team={team} includeRecorded={l.access.role==='commissioner'}/> : <p className="heating-up-help">Players become starred automatically for their next team game after earning an SSL custom Game Score of {HEATING_UP_THRESHOLD} or higher. No coins, tiers, or manual star selection.</p>}
      <h4>BENCH</h4>
      <p>
        {lineup.bench.map(id => name(id)).join(" · ") ||
          "Choose all nine starters first."}
      </p>
      <button className="red-btn" disabled={l.busy || !valid}>
        SAVE {game ? "GAME" : "DEFAULT"} LINEUP
      </button>
      {game && (
        <button
          type="button"
          className="outline-btn"
          disabled={l.busy || !validLineup(s, team, s.defaults?.[team])}
          onClick={async () => {
            if (
              await l.act("game_lineup", {
                team,
                game: game.id,
                useDefault: true,
              })
            )
              onDone?.();
          }}
        >
          USE DEFAULT LINEUP
        </button>
      )}
    </form>
  );
}

function OpponentScout({season,team,game}){
  const other=String(game.home)===String(team)?game.away:game.home;
  const opponent=season.teams.find(t=>String(t.id)===String(other));
  const opponentName=opponent?.name||'Opponent';
  const match=matchupDisplay(season,game);
  const scouting=opponentScouting(season,game,other);
  const prior=scouting?.previous;
  const confirmed=scouting?.lineup;
  const roster=rosterOf(season,other);
  return <aside className="ssl-scouting-panel" aria-label={'Matchup scouting for '+opponentName}>
    <h4>YOUR UPCOMING MATCHUP</h4>
    <p className="ssl-scouting-context">{match.awayName} @ {match.homeName}</p>
    <p><strong>{String(game.home)===String(team)?'HOME':'AWAY'} GAME</strong> · {match.stadium || 'Stadium TBD'} · {game.startsAt ? time(game.startsAt) : 'Date TBD'}</p>
    <p>Your opponent is <strong>{opponentName}</strong>. Their planned lineup for this upcoming game stays private.</p>
    <h4>{opponentName.toUpperCase()} · CURRENT ROSTER ({roster.length})</h4>
    <div className="ssl-scouting-roster">{roster.map(id=><span key={id}>{name(id)}</span>)}</div>
    <h4>LAST LINEUP USED</h4>
    {prior&&confirmed?<><p>From their most recently completed match against {season.teams.find(t=>String(t.id)===String(prior.home===other?prior.away:prior.home))?.name||'an opponent'}.</p>
      <ol className="ssl-scouting-lineup">{confirmed.starters.map((p,i)=><li key={i}>{name(p.player)} · {p.position}</li>)}</ol>
      <p><strong>Bench:</strong> {(confirmed.bench||[]).map(name).join(' · ')||'None recorded'}</p>
    </>:<p>No confirmed previous-game lineup is available yet. A future submitted lineup is never shown here.</p>}
  </aside>;
}

export function RosterManager({ league: l, focus=null }) {
  const s=l.season;
  const [team,setTeam]=useActingTeam(l);
  const [editDefault,setEditDefault]=useState(false);
  const [editingGame,setEditingGame]=useState(null);
  useEffect(()=>{setEditDefault(false);setEditingGame(null)},[s?.id,team]);
  useEffect(()=>{
    if(!focus||!team||!s)return;
    if(focus.focus==='game'&&teamGameLineups(s,team).some(g=>String(g.id)===String(focus.gameId))){setEditingGame(focus.gameId);setEditDefault(false)}
    if(focus.focus==='default'){setEditDefault(true);setEditingGame(null)}
    const id=focus.focus==='game'?'ssl-game-lineup-'+focus.gameId:focus.focus==='default'?'ssl-default-lineup':'ssl-roster-players';
    const frame=requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[focus?.requestId,team,s?.id]);
  if(!s)return <Box title="ROSTER"><p>No season has been created yet. Team rosters will appear after the draft starts.</p></Box>;
  const chosen=s.teams.find(t=>t.id===team);
  const roster=team?rosterOf(s,team):[];
  const playable=['postdraft','regular','postseason','retention'].includes(s.status)&&!s.offseasonTrading;
  const canEditDefault=playable && roster.length>=11;
  const hasDefault=team&&validLineup(s,team,s.defaults?.[team]);
  const fixtures=team?teamGameLineups(s,team):[];
  const ready=fixtures.filter(g=>gameLineupIsEditable(s,team,g));
  const defaultLineup=s.defaults?.[team];
  return <>
    {l.access.role==='commissioner'&&<Box title="COMMISSIONER · ALL TEAM LINEUPS">
      <p>Select any franchise to edit its default lineup or one of its upcoming game lineups. Your changes use the same Schedule records as GM submissions.</p>
      <TeamChooser s={s} value={team} onChange={setTeam} label="Manage franchise roster"/>
    </Box>}
    {!chosen?<Box title="ROSTER"><p>{l.access.role==='commissioner'?'Choose a team above to manage its roster.':'Your franchise will appear once the commissioner adds it to Season 1.'}</p></Box>:<>
      <div id="ssl-roster-players" className="ssl-roster-notification-focus"><Box title={`${chosen.name.toUpperCase()} · ROSTER`}>
        <p><strong>{roster.length} players</strong> · {hasDefault?'Default lineup saved':'Default lineup not saved yet'} · {s.status.toUpperCase()}</p>
        {roster.length===0?<p>Players will appear as they are drafted.</p>:<div className="roster-manager-players">{roster.map(id=><div key={id} className="roster-manager-player"><Player id={id} seasons={l.seasons}/><HeatMark playerId={id} inline/></div>)}</div>}
      </Box></div>
      <div id="ssl-default-lineup" className="ssl-roster-notification-focus"><Box title="DEFAULT LINEUP">
        <p>This lineup is the fallback for every game until you submit a specific game lineup. Changes here do not overwrite a game lineup already submitted.</p>
        {roster.length<11?<p><strong>Draft or acquire at least 11 players before saving a default lineup.</strong></p>:<>
          {hasDefault&&!editDefault&&<div className="roster-lineup-summary">
            <h3>CURRENT DEFAULT BATTING ORDER</h3>
            {defaultLineup.starters.map((p,i)=><p key={p.player}><strong>{i+1}.</strong> <Player id={p.player} seasons={l.seasons}/> · {p.position}</p>)}
            <p><strong>Bench:</strong> {defaultLineup.bench.map(name).join(' · ')||'None'}</p>
          </div>}
          {!canEditDefault?<p>Default-lineup editing opens after the draft and closes during the offseason.</p>:<>
            <button type="button" className="outline-btn" onClick={()=>setEditDefault(v=>!v)} aria-expanded={editDefault}>{editDefault?'CANCEL DEFAULT LINEUP EDIT':l.access.role==='commissioner'?'EDIT TEAM DEFAULT LINEUP':'EDIT MY DEFAULT LINEUP'}</button>
            {!hasDefault&&!editDefault&&<p>Click the button above to create the required default lineup.</p>}
            {editDefault&&<LineupEditor key={s.id+':'+team+':default'} league={l} team={team} onDone={()=>setEditDefault(false)}/>}
          </>}
        </>}
      </Box></div>
      <Box title="UPCOMING GAME LINEUPS">
        <p>Select a scheduled game, then submit the nine starters, batting order, defensive positions and bench. Your saved lineup appears automatically in Schedule and replaces the default for that matchup only. You may edit it again until the game is locked by its result upload.</p>
        {!s.schedulePublished?<p><strong>The commissioner must publish the schedule before game-specific lineups can be submitted.</strong></p>:!fixtures.length?<p>No scheduled games for this franchise yet.</p>:<>
          {fixtures.filter(g=>g.stage!=='cancelled').map(g=>{
            const editable=gameLineupIsEditable(s,team,g);
            const opponent=s.teams.find(t=>t.id===(g.away===team?g.home:g.away));
            const existing=effectiveGameLineup(s,team,g);
            const active=editingGame===g.id;
            return <section className="roster-fixture ssl-roster-notification-focus" id={'ssl-game-lineup-'+g.id} key={g.id}>
              <div className="roster-fixture-heading">
                <div><h3>{g.away===team?'VS':'AT'} {opponent?.name||'Opponent'}</h3>
                <p>{time(g.startsAt)} · {g.stage.toUpperCase()} · <strong>{savedLineupLabel(s,team,g)}</strong></p></div>
                {editable&&<button type="button" className="outline-btn" aria-expanded={active} onClick={()=>setEditingGame(active?null:g.id)}>{active?'CLOSE EDITOR':g.lineups?.[team]?'EDIT GAME LINEUP':'SUBMIT GAME LINEUP'}</button>}
              </div>
              {!active&&existing?.starters?.length>0&&<details><summary>VIEW LINEUP ON SCHEDULE</summary>{existing.starters.map((p,i)=><p key={i}>{i+1}. {name(p.player)} · {p.position}</p>)}<p><strong>Bench:</strong> {existing.bench?.map(name).join(' · ')||'None'}</p></details>}
              {active&&editable&&<><OpponentScout season={s} team={team} game={g}/><LineupEditor key={s.id+':'+team+':'+g.id} league={l} team={team} game={g} onDone={()=>setEditingGame(null)}/></>}
              {!editable&&<p className="roster-lock-status">{g.stage==='recorded'||g.stage==='final'||g.lockedAt?'Lineup locked after result upload.':'Lineup edits are unavailable for this game.'}</p>}
            </section>;
          })}
        </>}
      </Box>
    </>}
  </>;
}
function MyTeam({league:l}){
  return <RosterManager league={l}/>;
}

function Teams({ league: l }) {
  const s = l.season;
  const [tab,setTab]=useState('Franchises');
  const rankingsVisible=preseasonReady(s);
  const records = new Map(standings(s).map(t=>[t.id,t]));
  return (<>
    {rankingsVisible&&<div className="subnav" role="tablist" aria-label="Team tabs">
      {['Franchises','Power Rankings'].map(t=><button type="button" key={t}
        role="tab" aria-selected={tab===t} className={tab===t?'active':''}
        onClick={()=>setTab(t)}>{t}</button>)}
    </div>}
    {rankingsVisible&&tab==='Power Rankings'?<PowerRankings season={s} supabase={l.supabase}/>:
    <div className="season-team-columns">
      {[0, 1].map((col) => (
        <div key={col}>
          {teamsInLotteryOrder(s,s?.serverNow)
            .filter((_, i) => i % 2 === col)
            .map((t) => (
              <details className="panel season-team" key={t.id}>
                <summary>
                  {t.logoPath && (
                    <img
                      alt=""
                      width="35"
                      height="35"
                      style={{ objectFit: "contain" }}
                      src={teamLogo(l.supabase, t.logoPath)}
                    />
                  )}{" "}
                  {t.name}
                  <span className="season-team-record" title="Overall regular-season wins and losses">RECORD · {records.get(t.id)?.wins ?? 0}–{records.get(t.id)?.losses ?? 0}</span>
                  <small>
                    <ConferenceMark id={t.conference} size={29}/>{conferences[t.conference] || "Conference pending"} ·{" "}
                    {rosterOf(s, t.id).length} players
                  </small>
                </summary>
                {s.defaults[t.id]?.starters.map((p, i) => (
                  <div className="roster-line" key={p.player}>
                    <b>{i + 1}</b>
                    <Player id={p.player} seasons={l.seasons}/>
                    <span>{p.position}</span>
                  </div>
                ))}
                <h4>BENCH / ROSTER</h4>
                {rosterOf(s, t.id)
                  .filter(
                    (p) =>
                      !s.defaults[t.id]?.starters.some((x) => x.player === p),
                  )
                  .map((p) => (
                    <div key={p}>
                      <Player id={p} seasons={l.seasons}/>
                    </div>
                  ))}
              </details>
            ))}
        </div>
      ))}
    </div>}
  </>);
}
function ScheduleMatchupHeading({season,game}){
  const display=matchupDisplay(season,game);
  return <div className="ssl-matchup-card">
    <h3 className="ssl-matchup-heading" aria-label={display.awayName+" at "+display.homeName}>
      <span className="ssl-matchup-side ssl-matchup-away">
        <span className="ssl-matchup-team-name">{display.awayName}</span>
        <span className="ssl-matchup-side-label">AWAY</span>
      </span>
      <span className="ssl-matchup-at" aria-hidden="true">@</span>
      <span className="ssl-matchup-side ssl-matchup-home">
        <span className="ssl-matchup-team-name">{display.homeName}</span>
        <span className="ssl-matchup-side-label">HOME</span>
      </span>
    </h3>
    <p className="ssl-matchup-venue-line">
      <span className="ssl-matchup-stadium">{display.stadium || "HOME STADIUM TBD"}</span>
      {supportsStadiumVariant(display.stadium)&&<>
        <span className="ssl-matchup-separator" aria-hidden="true">•</span>
        <span className={matchupStadiumVariant(season,game)?'ssl-matchup-variant':'ssl-matchup-variant unset'}>
          {matchupStadiumVariant(season,game)?.toUpperCase()||'DAY/NIGHT TBD'}
        </span>
      </>}
      <span className="ssl-matchup-separator" aria-hidden="true">•</span>
      <time dateTime={game.startsAt||undefined} className="ssl-matchup-game-time">{game.startsAt?time(game.startsAt):"DATE & TIME TBD"}</time>
    </p>
  </div>;
}
function GameDateEditor({league:l,game:g}){
  const s=l.season;
  const [date,setDate]=useState('');
  const [open,setOpen]=useState(false);
  const canSet=['postdraft','regular'].includes(s.status)&&g.phase==='regular'&&g.stage==='scheduled'&&!g.lockedAt;
  if(!canSet)return null;
  return <div className="game-date-editor">
    <button type="button" className={g.startsAt?'outline-btn':'red-btn'} onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?'CLOSE DATE EDITOR':g.startsAt?'CHANGE GAME DATE & TIME':'SET GAME DATE & TIME'}</button>
    {open&&<form className="season-form" onSubmit={async e=>{e.preventDefault();if(!date)return;const start=new Date(date);if(!Number.isFinite(start.getTime()))return;const ok=await l.act('set_matchup_time',{game:g.id,startsAt:start.toISOString()});if(ok){setOpen(false);setDate('')}}}>
      <p><strong>Week {g.week}</strong> · Enter the actual matchup date and time in your device's timezone. It will display in Eastern Time.</p>
      <label>Matchup date and time<input type="datetime-local" required value={date} onChange={e=>setDate(e.target.value)}/></label>
      <button className="red-btn" disabled={!date||l.busy}>SAVE MATCHUP DATE</button>
    </form>}
  </div>;
}
function Schedule({ league: l, commissioner = false }) {
  const s = l.season,
    [form, setForm] = useState({ away: "", home: "", startsAt: "", label: "" }),
    [editing, setEditing] = useState(null),
    [reportGame, setReportGame] = useState(null),
    [team, setTeam] = useActingTeam(l);
  if (!s)
    return (
      <Box title="SCHEDULE">
        <p>No season has been set up.</p>
      </Box>
    );
  const admin = commissioner && l.access.role === "commissioner",
    games = [...s.games].sort((a,b)=>
      (a.phase==='regular'?0:1)-(b.phase==='regular'?0:1)||
      Number(a.week||999)-Number(b.week||999)||
      (a.startsAt?new Date(a.startsAt).getTime():0)-(b.startsAt?new Date(b.startsAt).getTime():0)||
      String(a.id).localeCompare(String(b.id))
    );
  return (
    <>
      <SeasonCalendar league={l} />
      {admin && <ScheduleGenerator league={l} />}
      {admin && s.status === "postseason" && <PlayoffPanel league={l} />}
      {admin && (
        <Box title="ENTER & PUBLISH SCHEDULE">
          <form
            className="season-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await l.act("schedule", {
                  ...form,
                  startsAt: iso(form.startsAt),
                })
              )
                setForm({ ...form, startsAt: "", label: "" });
            }}
          >
            {s.status === "postseason" && (
              <label>
                Playoff series
                <select
                  required
                  value={form.seriesId || ""}
                  onChange={(e) => {
                    const x = s.playoffSeries.find(
                      (x) => x.id === e.target.value,
                    );
                    const number =
                      s.games.filter((g) => g.seriesId === x?.id).length + 1;
                    setForm({
                      ...form,
                      seriesId: x?.id || "",
                      playoffRound: x?.round,
                      home: number % 2 ? x?.high : x?.low,
                      away: number % 2 ? x?.low : x?.high,
                      label: `${x?.round} · Game ${number}`,
                    });
                  }}
                >
                  <option value="">Choose series</option>
                  {(s.playoffSeries || [])
                    .filter((x) => !x.winner)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {s.teams.find((t) => t.id === x.high)?.name} vs{" "}
                        {s.teams.find((t) => t.id === x.low)?.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="season-inline">
              <TeamChooser
                s={s}
                value={form.away}
                onChange={(v) => setForm({ ...form, away: v })}
                label="Away team"
              />
              <TeamChooser
                s={s}
                value={form.home}
                onChange={(v) => setForm({ ...form, home: v })}
                label="Home team"
              />
            </div>
            <label>
              Game time (your device timezone)
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </label>
            {s.status === "postseason" && (
              <label>
                Playoff round
                <select
                  aria-label="Playoff round"
                  value={form.playoffRound || "quarterfinal"}
                  onChange={(e) =>
                    setForm({ ...form, playoffRound: e.target.value })
                  }
                >
                  <option value="quarterfinal">Quarterfinals · top 8</option>
                  <option value="semifinal">Semifinals</option>
                  <option value="final">Finals</option>
                </select>
              </label>
            )}
            <label>
              Series / game label
              <input
                value={form.label}
                maxLength={80}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Week 1 · Game 1 / Championship Game 3"
              />
            </label>
            <button
              className="red-btn"
              disabled={l.busy || !form.away || !form.home}
            >
              ADD GAME
            </button>
            <button
              type="button"
              className="outline-btn"
              disabled={l.busy || !s.games.length || s.schedulePublished}
              onClick={() => l.act("publish_schedule")}
            >
              {s.schedulePublished?'SCHEDULE PUBLISHED':'PUBLISH MATCHUPS PUBLICLY'}
            </button>
          </form>
          <p>
            {s.schedulePublished
              ? "The schedule is public, including Date TBD matchups. Date edits appear automatically."
              : "Publish generated matchups publicly now, even if every date is TBD."}
          </p>
        </Box>
      )}
      {admin && (
        <TeamChooser
          s={s}
          value={team}
          onChange={setTeam}
          label="Manage lineup on behalf of team"
        />
      )}
      {!s.schedulePublished && !admin ? (
        <Box title="SCHEDULE NOT PUBLISHED">
          <p>The commissioner is preparing the schedule.</p>
        </Box>
      ) : (
        games.map((g,i) => (
          <React.Fragment key={g.id}>
          {g.week && (i===0 || games[i-1].week!==g.week) && <h2 className="schedule-week-heading">WEEK {g.week} <small>· SIX MATCHUPS</small></h2>}
          <section className="panel season-game">
            <div>
              <small className="ssl-matchup-week-label">
                {g.postponed ? "POSTPONED · " : ""}
                {g.label || g.phase}
              </small>
              <ScheduleMatchupHeading season={s} game={g} />
              <p className="matchup-conference"><ConferenceMark id={s.teams.find(t=>t.id===g.home)?.conference} size={19}/> {matchupType(s,g)}</p>
              {g.announcement && <p>{g.announcement}</p>}
              {g.youtubeUrl && (
                <a href={g.youtubeUrl} target="_blank" rel="noreferrer">
                  Watch on Supa League TV
                </a>
              )}
              <strong>
                {g.stage === "final"
                  ? `${g.result.scores[g.away]} – ${g.result.scores[g.home]}`
                  : g.stage === "recorded"
                    ? "AWAITING PREMIERE RESULT RELEASE · LINEUPS LOCKED"
                    : g.stage.toUpperCase()}
              </strong>
            </div>
            {team &&
              [g.away, g.home].includes(team) &&
              (g.stage === "scheduled" || g.stage === "live") &&
              !g.lockedAt && (
                <button
                  className="outline-btn"
                  onClick={() => setEditing(editing === g.id ? null : g.id)}
                >
                  {g.lineups[team] ? "EDIT SUBMITTED" : "SUBMIT"} LINEUP
                </button>
              )}
            {admin && <GameDateEditor league={l} game={g}/>}
            {admin && (
              <div className="season-inline">
                <button
                  className="red-btn"
                  disabled={
                    l.busy || !["regular", "postseason"].includes(s.status)
                  }
                  onClick={() =>
                    setReportGame(reportGame === g.id ? null : g.id)
                  }
                >
                  {["recorded", "final"].includes(g.stage)
                    ? "REPLACE / CORRECT REPORT"
                    : "UPLOAD PROJECT RIO XLSX & LOCK LINEUPS"}
                </button>
                {!["final", "cancelled"].includes(g.stage) && (
                  <BroadcastControls league={l} game={g} />
                )}
                {g.stage === "scheduled" && (
                  <details>
                    <summary>RESCHEDULE GAME</summary>
                    <form
                      className="season-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        l.act("reschedule", {
                          game: g.id,
                          startsAt: iso(f.get("time")),
                          label: f.get("label"),
                        });
                      }}
                    >
                      <label>
                        New game time
                        <input name="time" required type="datetime-local" />
                      </label>
                      <label>
                        Game label
                        <input
                          name="label"
                          defaultValue={g.label}
                          maxLength={80}
                        />
                      </label>
                      <button className="outline-btn" disabled={l.busy}>
                        SAVE NEW GAME TIME
                      </button>
                    </form>
                  </details>
                )}
                <details>
                  <summary>VIEW SUBMITTED / DEFAULT LINEUPS</summary>
                  {[g.away, g.home].map((id) => (
                    <div key={id}>
                      <h4>{s.teams.find((t) => t.id === id)?.name}</h4>
                      <HeatingStatus season={s} game={g} team={id} includeRecorded={l.access.role==='commissioner'}/>
                      {(g.lineups[id] || s.defaults[id])?.starters.map(
                        (p, i) => (
                          <p key={i}>
                            {i + 1}. {name(p.player)} · {p.position}
                          </p>
                        ),
                      )}
                      <p>
                        <strong>Bench:</strong>{" "}
                        {(g.lineups[id] || s.defaults[id])?.bench
                          .map(name)
                          .join(" · ") || "Not submitted"}
                      </p>
                    </div>
                  ))}
                </details>
              </div>
            )}
            {editing === g.id && team && (
              <LineupEditor
                key={g.id + team}
                league={l}
                team={team}
                game={g}
                onDone={() => setEditing(null)}
              />
            )}
            {reportGame === g.id && admin && (
              <ReportImport
                league={l}
                game={g}
                onDone={() => setReportGame(null)}
              />
            )}
          </section>
          </React.Fragment>
        ))
      )}
    </>
  );
}
function ReportImport({ league: l, game, onDone }) {
  const [preview, setPreview] = useState(null),
    [awayLabel, setAwayLabel] = useState(""),
    [mvp, setMvp] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  return (
    <div className="report-import">
      <h3>PROJECT RIO RESULT REVIEW</h3>
      <p>
        Map team labels and any ambiguous Mii/name rows. Add an "Item Score"
        column at the end of the Project Rio Stats worksheet. The site
        automatically scores the game's batting, defense and pitching stats,
        adds Item Score (blank means 0), and grants Heating Up at {HEATING_UP_THRESHOLD}+.
        Corrected reports replace prior totals and hot streak results.
      </p>
      <input
        type="file"
        accept=".xlsx"
        aria-label="Project Rio XLSX"
        disabled={loading}
        onChange={async (e) => {
          if (!e.target.files[0]) return;
          setLoading(true);
          setError("");
          try {
            const p = await readRio(
              e.target.files[0],
              { ...l.season, rosters: game.frozenRosters || l.season.rosters },
              game,
              pool,
            );
            setPreview(p);
            setAwayLabel(p.labels[0]);
          } catch (e) {
            setError(e.message);
          } finally {
            setLoading(false);
          }
        }}
      />
      {loading && <p>Reading report…</p>}
      {error && <p role="alert">{error}</p>}
      {preview && (
        <>
          <label>
            Away team’s label in the report
            <select
              value={awayLabel}
              onChange={(e) => setAwayLabel(e.target.value)}
            >
              {preview.labels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </label>
          <div className="season-table">
            <table>
              <thead>
                <tr>
                  <th>Rio player</th>
                  <th>Report team</th>
                  <th>Item Score</th><th>Calculated Game Score</th>
                  <th>SSL player</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => {
                  const team = r.label === awayLabel ? game.away : game.home;
                  return (
                    <tr key={i}>
                      <td>{r.player}</td>
                      <td>{r.label}</td>
                      <td>{r.itemscore === '' ? 0 : r.itemscore ?? 0}</td>
                      <td>{(() => {try{const score=previewCustomGameScore(preview,r);
                        return <><strong>{score.gameScore}</strong>{score.heatingUp?' ★':''}</>;
                      }catch(e){return <span title={e.message}>Check stats</span>}})()}</td>
                      <td>
                        <select
                          aria-label={`Map ${r.player} row ${r.row}`}
                          value={r.chosen}
                          onChange={(e) =>
                            setPreview((p) => ({
                              ...p,
                              rows: p.rows.map((x, j) =>
                                j === i
                                  ? { ...x, chosen: Number(e.target.value) }
                                  : x,
                              ),
                            }))
                          }
                        >
                          <option value="">Choose player</option>
                          {(
                            game.frozenRosters?.[team] ||
                            rosterOf(l.season, team)
                          ).map((id) => (
                            <option key={id} value={id}>
                              {name(id)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h4>REVIEW PITCHERS</h4>
          <p>
            Assign each pitching row to one player. Two Miis with the same
            report name must be mapped separately.
          </p>
          <div className="season-table">
            <table>
              <thead>
                <tr>
                  <th>Rio pitcher</th>
                  <th>Team</th>
                  <th>IP</th>
                  <th>K</th>
                  <th>SSL player</th>
                </tr>
              </thead>
              <tbody>
                {preview.pitch.map((r, i) => {
                  const team = r.label === awayLabel ? game.away : game.home;
                  return (
                    <tr key={i}>
                      <td>{r.player}</td>
                      <td>{r.label}</td>
                      <td>{Number(r.inningspitched).toFixed(2)}</td>
                      <td>{r.strikeouts || 0}</td>
                      <td>
                        <select
                          aria-label={`Map pitcher row ${r.row}`}
                          value={r.chosen}
                          onChange={(e) =>
                            setPreview((p) => ({
                              ...p,
                              pitch: p.pitch.map((v, j) =>
                                i === j
                                  ? { ...v, chosen: Number(e.target.value) }
                                  : v,
                              ),
                            }))
                          }
                        >
                          <option value="">Choose pitcher</option>
                          {(
                            game.frozenRosters?.[team] ||
                            rosterOf(l.season, team)
                          ).map((id) => (
                            <option key={id} value={id}>
                              {name(id)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h4>FINAL SCORE REVIEW</h4>
          {preview.labels.map((label) => (
            <p key={label}>
              {label}:{" "}
              {preview.rows
                .filter((r) => r.label === label)
                .reduce((n, r) => n + Number(r.runs || 0), 0)}{" "}
              runs ·{" "}
              {preview.rows
                .filter((r) => r.label === label)
                .reduce((n, r) => n + Number(r.hits || 0), 0)}{" "}
              hits
            </p>
          ))}
          <label>
            Game MVP (optional)
            <select value={mvp} onChange={(e) => setMvp(e.target.value)}>
              <option value="">None / not recorded</option>
              {preview.rows
                .filter((r) => r.chosen)
                .map((r) => (
                  <option key={r.row} value={r.chosen}>
                    {name(r.chosen)}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="red-btn"
            disabled={
              l.busy ||
              preview.rows.some((r) => !r.chosen) ||
              preview.pitch.some((r) => !r.chosen)
            }
            onClick={async () => {
              try {
                const report = buildReport(
                  preview,
                  awayLabel,
                  {
                    ...l.season,
                    rosters: game.frozenRosters || l.season.rosters,
                  },
                  game,
                  pool,
                  mvp,
                );
                if (await l.act("result", { game: game.id, report })) onDone();
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            SAVE PRIVATE REPORT & LOCK LINEUPS
          </button>
        </>
      )}
    </div>
  );
}
function Trades({ league: l, messages = false }) {
  const s = l.season,
    [team, setTeam] = useActingTeam(l),
    [participants, setParticipants] = useState([]),
    [moves, setMoves] = useState([]),
    [move, setMove] = useState({
      from: "",
      to: "",
      kind: "player",
      id: "",
      quantity: 1,
    }),
    [note, setNote] = useState(""),
    [counter, setCounter] = useState(null);
  useEffect(() => {
    setParticipants(team ? [team] : []);
    setMoves([]);
    setCounter(null);
  }, [team, s?.id]);
  if (!s)
    return (
      <Box title="TRANSACTIONS">
        <p>No season yet.</p>
      </Box>
    );
  const admin = l.access.role === "commissioner",
    can = admin || l.access.role === "gm",
    teamName = (id) => s.teams.find((t) => t.id === id)?.name || "Team",
    description = (m) =>
      m.kind === "player"
        ? name(m.id)
        : m.kind === "coin"
          ? 'Legacy coin transfer (retired)'
          : (() => {
              const a = s.pickAssets.find((p) => p.id === m.id);
              return `S${s.tradePickSeason || s.number + 1} · Round ${a?.round || "?"} · ${teamName(a?.originalTeam)}`;
            })(),
    showMoves = (body) => (
      <ul>
        {body.moves.map((m, i) => (
          <li key={i}>
            <strong>
              {teamName(m.from)} → {teamName(m.to)}:
            </strong>{" "}
            {description(m)}
          </li>
        ))}
      </ul>
    );
  return (
    <>
      {can && (
        <>
          <details className={`trade-composer ${messages ? "inbox-composer" : "new-trade-composer"}`} open={!messages || !!counter}><summary>WRITE A NEW OFFER / COUNTEROFFER</summary><Box title={messages ? "TRADE MESSAGES" : "PROPOSE A TRADE"}>
            {admin && (
              <TeamChooser
                s={s}
                value={team}
                onChange={setTeam}
                label="Act on behalf of team"
              />
            )}
            {s.tradingOpen && team ? (
              <>
                <p>
                  All involved teams must accept the same offer, followed by
                  commissioner approval. Keep at least nine tradable next-season player picks. Without a retained Stadium, the team also receives a nontradable Stadium Pick (ten turns minimum); teams retaining a Stadium get no new Stadium Pick. Stadium Picks can never be traded.
                  Rosters below 11 must be filled immediately after the trade.
                </p>
                <details className="trade-participants"><summary>PARTICIPATING TEAMS ({participants.length})</summary><div className="season-team-checks">
                  {teamsInLotteryOrder(s,s?.serverNow).map((t) => (
                    <label key={t.id}>
                      <input
                        type="checkbox"
                        checked={participants.includes(t.id)}
                        disabled={t.id === team}
                        onChange={() => {
                          setMoves([]);
                          setParticipants((a) =>
                            a.includes(t.id)
                              ? a.filter((x) => x !== t.id)
                              : [...a, t.id],
                          );
                        }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
                </details><p>{participants.map(teamName).join(" · ")}</p>
                <div className="trade-compose">
                  <label>
                    From
                    <select
                      aria-label="From"
                      value={move.from}
                      onChange={(e) =>
                        setMove({ ...move, from: e.target.value, id: "" })
                      }
                    >
                      <option value="">Choose team</option>
                      {participants.map((id) => (
                        <option key={id} value={id}>
                          {teamName(id)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To
                    <select
                      aria-label="To"
                      value={move.to}
                      onChange={(e) => setMove({ ...move, to: e.target.value })}
                    >
                      <option value="">Choose team</option>
                      {participants
                        .filter((id) => id !== move.from)
                        .map((id) => (
                          <option key={id} value={id}>
                            {teamName(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Asset
                    <select
                      aria-label="Trade asset type"
                      value={move.kind}
                      onChange={(e) =>
                        setMove({ ...move, kind: e.target.value, id: "" })
                      }
                    >
                      <option value="player">Player</option>
                      <option value="pick">Next-season draft pick</option>
                    </select>
                  </label>
                  <label>
                      {move.kind === "player" ? "Player" : "Pick"}
                      <select
                        aria-label={move.kind === "player" ? "Player" : "Pick"}
                        value={move.id}
                        onChange={(e) =>
                          setMove({ ...move, id: e.target.value })
                        }
                      >
                        <option value="">Choose asset</option>
                        {move.kind === "player"
                          ? rosterOf(s, move.from).map((id) => (
                              <option key={id} value={id}>
                                {name(id)}
                              </option>
                            ))
                          : s.pickAssets
                              .filter((p) => p.owner === move.from)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  Round {p.round} · {teamName(p.originalTeam)}
                                </option>
                              ))}
                      </select>
                    </label>
                  <button
                    className="outline-btn"
                    disabled={
                      !move.from ||
                      !move.to ||
                      move.from === move.to ||
                      !move.id
                    }
                    onClick={() => {
                      setMoves((a) => [
                        ...a,
                        {
                          ...move,
                          id:
                            move.kind === "player" ? Number(move.id) : move.id,
                        },
                      ]);
                      setMove({ ...move, id: "" });
                    }}
                  >
                    ADD TO OFFER
                  </button>
                </div>
                {moves.map((m, i) => (
                  <div className="trade-asset" key={i}>
                    <span>
                      {teamName(m.from)} → {teamName(m.to)}: {description(m)}
                    </span>
                    <button
                      aria-label={`Remove trade asset ${i + 1}`}
                      onClick={() =>
                        setMoves((a) => a.filter((_, j) => i !== j))
                      }
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
                <label>
                  Note
                  <textarea
                    maxLength={1000}
                    aria-label="Trade note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                {counter && (
                  <p>
                    Counteroffer to {counter.slice(0, 8)}. Sending it replaces
                    that pending offer.
                  </p>
                )}
                <button
                  className="red-btn"
                  disabled={l.busy || participants.length < 2 || !moves.length}
                  onClick={async () => {
                    if (
                      await l.act("submit_trade", {
                        team,
                        teams: participants,
                        moves,
                        note,
                        counterTo: counter,
                      })
                    ) {
                      setMoves([]);
                      setNote("");
                      setCounter(null);
                    }
                  }}
                >
                  SUBMIT {counter ? "COUNTEROFFER" : "TRADE OFFER"}
                </button>
              </>
            ) : (
              <p>
                Regular-season trades close after Week 12. Offseason trades
                reopen after extensions close and stay open through next-season
                preparation until the draft begins.
              </p>
            )}
          </Box>
          </details>
          <Box title="YOUR TRADE INBOX">
            {!l.inbox.length && <p>No offers yet.</p>}
            {l.inbox.map((o) => (
              <article className="season-offer" key={o.id}>
                <h3>
                  {o.body.teams.map(teamName).join(" / ")} ·{" "}
                  {o.status.toUpperCase()}
                </h3>
                <small>{time(o.createdAt)}</small>
                {showMoves(o.body)}
                {o.body.note && <p>{o.body.note}</p>}
                <p>Accepted: {o.accepted.map(teamName).join(", ")}</p>
                {["pending", "ready"].includes(o.status) && (
                  <div className="season-inline">
                    {team &&
                      o.body.teams.includes(team) &&
                      !o.accepted.includes(team) && (
                        <button
                          disabled={l.busy}
                          className="red-btn"
                          onClick={() =>
                            l.act("accept_trade", { team, offer: o.id })
                          }
                        >
                          ACCEPT EXACT OFFER
                        </button>
                      )}
                    {(admin || o.body.teams.includes(team)) && (
                      <>
                        <button
                          disabled={l.busy}
                          className="outline-btn"
                          onClick={() =>
                            l.act("reject_trade", { team, offer: o.id })
                          }
                        >
                          REJECT
                        </button>
                        <button
                          className="outline-btn"
                          onClick={() => {
                            setParticipants(o.body.teams);
                            setMoves(o.body.moves);
                            setNote(o.body.note || "");
                            setCounter(o.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          COUNTER
                        </button>
                      </>
                    )}
                    {(admin || o.body.sender === team) && (
                      <button
                        disabled={l.busy}
                        className="outline-btn"
                        onClick={() =>
                          l.act("cancel_trade", { team, offer: o.id })
                        }
                      >
                        CANCEL
                      </button>
                    )}
                    {admin && o.status === "ready" && (
                      <button
                        disabled={l.busy}
                        className="red-btn"
                        onClick={() => l.act("approve_trade", { offer: o.id })}
                      >
                        APPROVE & PROCESS
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </Box>
        </>
      )}
      <Box title="COMPLETED TRANSACTIONS">
        {!(s.transactions || []).length && <p>No approved trades yet.</p>}
        {(s.transactions || []).map((o) => (
          <article className="season-offer" key={o.id}>
            <small>{time(o.createdAt)}</small>
            {showMoves(o.body)}
          </article>
        ))}
      </Box>
    </>
  );
}
function Extensions({ league }) {
  return <ContractExtensions league={league} />;
}
function FreeAgency({ league: l }) {
  const [signing, setSigning] = useState(null),
    [drop, setDrop] = useState("");
  const s = l.season,
    [team, setTeam] = useActingTeam(l),
    [query, setQuery] = useState("");
  const used = new Set(Object.values(s?.rosters || {}).flat()),
    can =
      ["gm", "commissioner"].includes(l.access.role) &&
      team &&
      s &&
      ["postdraft", "regular", "postseason", "retention"].includes(s.status);
  return (
    <>
      <Box title="FREE AGENCY">
        {l.access.role === "commissioner" && (
          <TeamChooser s={s} value={team} onChange={setTeam} />
        )}
        <p>
          Roster size: 11–14 players. Free agents are first come, first served.
          At 14, select a player to drop in the same signing. Following a trade
          that leaves fewer than 11, sign free agents or randomly fill the exact
          number needed, then update your default lineup.
        </p>
        {can && (
          <>
            <p>{rosterOf(s, team).length} rostered</p>
            <button
              className="outline-btn"
              disabled={l.busy || rosterOf(s, team).length >= 11}
              onClick={() => l.act("random_fill", { team })}
            >
              RANDOM FILL TO 11
            </button>
            <details>
              <summary>YOUR ROSTER · DROP PLAYERS</summary>
              {rosterOf(s, team).map((id) => (
                <div className="roster-line" key={id}>
                  <Player id={id} seasons={l.seasons} />
                  <button
                    className="outline-btn"
                    disabled={l.busy || rosterOf(s, team).length <= 11}
                    onClick={() => l.act("drop_player", { team, player: id })}
                  >
                    DROP
                  </button>
                </div>
              ))}
            </details>
          </>
        )}
        {signing && (
          <div
            role="dialog"
            aria-label="Swap free agent into full roster"
            className="report-import"
          >
            <h3>ROSTER FULL · SIGN {name(signing)}</h3>
            <p>
              Select one player to drop. The drop and signing happen together.
            </p>
            <select
              aria-label="Player to drop"
              value={drop}
              onChange={(e) => setDrop(e.target.value)}
            >
              <option value="">Select player to drop</option>
              {rosterOf(s, team).map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
            </select>
            <button
              className="red-btn"
              disabled={l.busy || !drop}
              onClick={async () => {
                if (
                  await l.act("add_player", {
                    team,
                    player: signing,
                    dropPlayer: Number(drop),
                  })
                ) {
                  setSigning(null);
                  setDrop("");
                }
              }}
            >
              DROP & SIGN
            </button>
            <button className="outline-btn" onClick={() => setSigning(null)}>
              CANCEL
            </button>
          </div>
        )}
        <input
          aria-label="Search free agents"
          placeholder="Search available players"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="season-player-list">
          {pool
            .filter(
              (p) =>
                !used.has(p.id) &&
                p.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((p) => (
              <div key={p.id}>
                <Player id={p.id} seasons={l.seasons} />
                <span>{p.class}</span>
                {can && (
                  <button
                    className="outline-btn"
                    disabled={l.busy}
                    onClick={() => {
                      if (rosterOf(s, team).length >= 14) setSigning(p.id);
                      else l.act("add_player", { team, player: p.id });
                    }}
                  >
                    SIGN PLAYER
                  </button>
                )}
              </div>
            ))}
        </div>
      </Box>
    </>
  );
}
function Standings({ league: l }) {
  const [view, setView] = useState("overall");
  const name = view === "overall" ? "League Overall" : conferences[view];
  const champ = view !== "overall" && l.season?.conferenceChampions?.[view]
    ? l.season.teams.find(t=>t.id===l.season.conferenceChampions[view])?.name
    : null;
  const rows = standings(l.season).filter(t=>view==="overall"||t.conference===view);
  return (
    <Box title="REGULAR-SEASON STANDINGS">
      <div className="standings-conference-nav" role="group" aria-label="Select standings conference">
        <button type="button" className={view==="overall"?"active":""} aria-pressed={view==="overall"} onClick={()=>setView("overall")}>
          <img className="ssl-standings-logo" src={import.meta.env.BASE_URL + "sluggers-supa-league-logo.svg"} width={60} height={60} alt="Sluggers Supa League logo"/><strong>Overall</strong>
        </button>
        {(["supa","galaxy"]).map(k=>(
          <button type="button" key={k} className={view===k?"active":""} aria-pressed={view===k} onClick={()=>setView(k)}>
            <ConferenceMark id={k} size={60}/><strong>{conferences[k]}</strong>
          </button>
        ))}
      </div>
      <div className="standings-conference-banner" aria-live="polite">
        {view === "overall" ? (
          <img className="ssl-standings-logo" src={import.meta.env.BASE_URL + "sluggers-supa-league-logo.svg"} width={118} height={118} alt="Sluggers Supa League logo"/>
        ) : <ConferenceMark id={view} size={118}/>}
        <div>
          <span className="eyebrow dark">{view === "overall" ? "BOTH CONFERENCES" : "SIX TEAMS · ONE CHAMPION"}</span>
          <h3>{name}</h3>
          <p>{view==="overall" ? "All twelve SSL teams in one table."
            : champ ? `Conference Champions: ${champ}`
            : "Conference champion awarded at regular-season end"}
          </p>
        </div>
      </div>
      <div className="season-table">
        <table>
          <thead>
            <tr>{["Team","GP","W","L","Win %","RF","RA","Diff"].map(x=><th key={x}>{x}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(t=>(
              <tr key={t.id}>
                <td><span className="standings-team-name"><ConferenceMark id={t.conference} size={28}/><span>{t.name}<small style={{display:"block"}}>{conferences[t.conference]||"Conference pending"}</small></span></span></td>
                <td>{t.wins+t.losses}</td><td>{t.wins}</td><td>{t.losses}</td>
                <td>{t.pct.toFixed(3)}</td><td>{t.runsFor}</td><td>{t.runsAgainst}</td>
                <td>{t.runsFor-t.runsAgainst}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="standings-empty">
              {l.season ? "No teams assigned to this conference yet." : "Teams will appear here after GM registration and season setup."}
            </td></tr>}
          </tbody>
        </table>
      </div>
      <p>Ordered by winning percentage, then run differential, then fewer runs allowed. The top eight overall teams qualify for playoffs.</p>
    </Box>
  );
}
function TeamStats({ league: l }) {
  const [view, setView] = useState("Totals");
  const isAverage = view === "Averages per Game";
  const keys = [
    "atBats",
    "hits",
    "runs",
    "homeRuns",
    "rbi",
    "putouts",
    "assists",
    "bobbles",
    "pitchStrikeouts",
    "earnedRuns",
    "gameScore",
  ];
  const s = l.season;
  const records = new Map(standings(s).map(t => [t.id, t]));
  const statLabel = k => k === 'gameScore' ? 'Game Score' : k.replace(/([A-Z])/g, " $1");
  return (
    <Box title={isAverage ? "TEAM STAT AVERAGES" : "TEAM STAT TOTALS"}>
      <div className="stat-view-switch" role="group" aria-label="Team stat display">
        {["Totals", "Averages per Game"].map(option => (
          <button
            key={option}
            type="button"
            className={view === option ? "active" : ""}
            aria-pressed={view === option}
            onClick={() => setView(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="season-table" role="region" aria-label={isAverage ? "Team averages per game" : "Team stat totals"} tabIndex={0}>
        <table>
          <caption className="team-stats-caption">{isAverage ? "Team averages per completed game" : "Team season totals"}</caption>
          <thead>
            <tr>
              <th>Team</th>
              <th>GP</th>
              <th>Record (W–L)</th><th>Home Record (W–L)</th><th>Away Record (W–L)</th>
              {keys.map(k => <th key={k}>{statLabel(k)}{isAverage ? " / G" : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {teamsInLotteryOrder(s,s?.serverNow).map(t => {
              const games = s.games.filter(g =>
                g.stage === "final" && [g.away, g.home].includes(t.id)
              );
              const all = games.flatMap(g =>
                (g.result?.players || []).filter(p => p.team === t.id)
              );
              const totals = Object.fromEntries(
                keys.map(k => [k, all.reduce((sum, p) => sum + (Number(k === 'gameScore' ? p.gameScore : p.stats?.[k]) || 0), 0)])
              );
              const record = records.get(t.id);
              return (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{games.length}</td>
                  <td><strong>{record?.wins ?? 0}–{record?.losses ?? 0}</strong></td>
                  <td>{record?.homeWins ?? 0}–{record?.homeLosses ?? 0}</td>
                  <td>{record?.awayWins ?? 0}–{record?.awayLosses ?? 0}</td>
                  {keys.map(k => (
                    <td key={k} className="team-stats-number">
                      {isAverage
                        ? games.length ? (totals[k] / games.length).toFixed(2) : "—"
                        : totals[k]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="team-stats-explainer">
        {isAverage
          ? "Team averages are the sum of all players' stats divided by the team's completed games. GP and all W–L records remain totals; teams without completed games show a dash."
          : "Team totals combine every player's stats from completed games."}
        {" "}Overall, Home and Away Records count released regular-season games only.
      </p>
    </Box>
  );
}
function History({ league: l }) {
  const [tab, setTab] = useState("Past Seasons"),
    records = Object.entries(
      l.seasons.reduce((all, s) => {
        for (const [id, stats] of Object.entries(aggregate(s))) {
          const row = all[id] || {
            gamesPlayed: 0,
            hits: 0,
            homeRuns: 0,
            rbi: 0,
            pitchStrikeouts: 0,
            gameScore: 0,
          };
          for (const k of Object.keys(row)) row[k] += stats[k] || 0;
          all[id] = row;
        }
        return all;
      }, {}),
    );
  return (
    <>
      <div className="subnav">
        {["Past Seasons", "League Records"].map((t) => (
          <button
            className={t === tab ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Past Seasons" ? (
        l.seasons.map((s) => (
          <details className="panel season-box" key={s.id}>
            <summary>
              {s.name} · {s.status} ·{" "}
              {s.games.filter((g) => g.stage === "final").length} completed
              games
            </summary>
            <p>
              Champion:{" "}
              {s.teams.find((t) => t.id === s.champion)?.name || "Not decided"}
            </p>
            <p>{teamsInLotteryOrder(s,s?.serverNow).map((t) => t.name).join(" · ")}</p>
            <button className="outline-btn" onClick={() => l.setSelected(s.id)}>
              VIEW THIS SEASON IN LEAGUE TABS
            </button>
            <details>
              <summary>DRAFT SUMMARY</summary>
              {s.picks.map((p) => (
                <p key={p.number}>
                  #{p.number} · {s.teams.find((t) => t.id === p.team)?.name} ·{" "}
                  {p.kind === "stage" ? `STADIUM · ${p.stage}` : name(p.player)}
                </p>
              ))}
            </details>
          </details>
        ))
      ) : (
        <Box title="CAREER LEAGUE RECORDS">
          {["gamesPlayed", "hits", "homeRuns", "rbi", "pitchStrikeouts", "gameScore"].map(
            (k) => (
              <section key={k}>
                <h3>{k.replace(/([A-Z])/g, " $1").toUpperCase()}</h3>
                {records.length ? (
                  [...records]
                    .sort((a, b) => b[1][k] - a[1][k])
                    .slice(0, 5)
                    .map(([id, st]) => (
                      <p key={id}>
                        {name(id)} · {st[k]}
                      </p>
                    ))
                ) : (
                  <p>No verified results yet.</p>
                )}
              </section>
            ),
          )}
        </Box>
      )}
    </>
  );
}
function PlayoffBracketSections({league:l,initialTab='Pre-season'}){
  const s=l.season;
  const [tab,setTab]=useState(initialTab);
  useEffect(()=>{setTab(initialTab)},[initialTab]);
  // These are display-only tabs; preseason results remain in their dedicated
  // table, while the existing official playoff bracket remains unchanged.
  return <>
    <div className="subnav" role="tablist" aria-label="Playoff bracket sections">
      {['Playoffs','Pre-season'].map(section=><button
        key={section} type="button" role="tab" aria-selected={tab===section}
        className={tab===section?'active':''}
        onClick={()=>setTab(section)}>{section}</button>)}
    </div>
    {tab==='Pre-season'?<PreseasonTournament league={l}/>:
      s&&['postseason','retention','offseason','archived'].includes(s.status)?<>
        <PlayoffPanel league={l}/>
        <Schedule league={{...l,season:{...s,games:s.games.filter(g=>g.phase==='playoffs')}}}/>
      </>:<Box title="PLAYOFFS CLOSED"><p>Opens after the regular season.</p></Box>}
  </>;
}
export const seasonPages = [
  "Schedule",
  "Standings",
  "Teams",
  "Team Stats",
  "Transactions",
  "Playoff Bracket",
  "Voting",
  "SSL History",
  "Draft Room",
  "Preseason Tournament",
  "Free Agency",
  "Messages",
];
export function SeasonPage({ page, league: l, section=null }) {
  return (
    <>
      <Title>{page.toUpperCase()}</Title>
      <SeasonSelector league={l} />
      <SeasonFeedback league={l} />
      {page === "Schedule" ? (
        <Schedule league={l} />
      ) : page === "Standings" ? (
        <Standings league={l} />
      ) : page === "Teams" ? (
        <Teams league={l} />
      ) : page === "Preseason Tournament" ? (
        <PreseasonTournament league={l} />
      ) : page === "Team Stats" ? (
        <TeamStats league={l} />
      ) : page === "Voting" ? (
        <PublicBallots league={l} />
      ) : page === "Draft Room" ? (
        <Draft league={l} />
      ) : page === "Free Agency" ? (
        <FreeAgency league={l} />
      ) : page === "SSL History" ? (
        <History league={l} />
      ) : page === "Playoff Bracket" ? (
        {section?<PlayoffBracketSections league={l} initialTab={section}/>:<PlayoffBracketSections league={l}/>}
      ) : (
        <Trades league={l} messages={page === "Messages"} />
      )}
    </>
  );
}
export function SeasonTeamTools({ league, section='Roster', focus=null }) {
  return <>
    <SeasonSelector league={league}/>
    <SeasonFeedback league={league}/>
    {section==='Roster'&&<RosterManager league={league} focus={focus}/>}
    {section==='Extensions'&&<Extensions league={league}/>}
  </>;
}
export function SeasonHome({ league: l, go }) {
  const s = l.season;
  if (!s) return null;
  const finals = s.games.filter((g) => g.stage === "final").slice(-3),
    upcoming = s.games.filter((g) => g.stage !== "final").slice(0, 3);
  return (
    <div className="season-home">
      <Box title={`${s.name} · ${s.status.toUpperCase()}`}>
        <p>
          {s.teams.length} teams · {s.picks.length} draft picks ·{" "}
          {s.baseDraftRounds || 12} main rounds
        </p>
        <button
          className="outline-btn"
          onClick={() =>
            go(s.status === "drafting" ? "Draft Room" : "Schedule")
          }
        >
          OPEN {s.status === "drafting" ? "DRAFT ROOM" : "SCHEDULE"}
        </button>
        {s.awardsAnnouncement && (
          <p style={{ whiteSpace: "pre-wrap" }}>{s.awardsAnnouncement}</p>
        )}
        {s.games
          .filter((g) => g.announcement)
          .map((g) => (
            <p key={"news" + g.id}>
              <strong>{g.postponed ? "POSTPONED: " : "LEAGUE UPDATE: "}</strong>
              {g.announcement}
            </p>
          ))}
        {upcoming.map((g) => (
          <p key={g.id}>
            {s.teams.find((t) => t.id === g.away)?.name} at{" "}
            {s.teams.find((t) => t.id === g.home)?.name} · {time(g.startsAt)}
          </p>
        ))}
        {finals.map((g) => (
          <p key={g.id}>
            {s.teams.find((t) => t.id === g.away)?.name}{" "}
            {g.result.scores[g.away]} – {g.result.scores[g.home]}{" "}
            {s.teams.find((t) => t.id === g.home)?.name}
          </p>
        ))}
      </Box>
      {preseasonReady(s)&&<>
        <PowerRankings season={s} supabase={l.supabase}/>
        <PreseasonTournament league={l} compact/>
        <button type="button" className="outline-btn ssl-pre-home-link"
          onClick={()=>go('Playoff Bracket')}>OPEN FULL PRE-SEASON BRACKET</button>
      </>}
    </div>
  );
}
