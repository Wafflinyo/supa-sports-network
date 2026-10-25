import {DraftPlayers, DraftPickBoard} from './DraftPlayers.jsx';
import {heatingUpForSeason} from './heating-up.js';
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
  NextSeason,
  ScheduleGenerator,
} from "./SeasonCalendar.jsx";
import React, { useState, useEffect, useMemo } from "react";
import pool from "./players.json";
import { teamLogo } from "./TeamIdentity.jsx";
import { ConferenceMark } from './ConferenceMark.jsx';
import { PlayerPortrait } from "./PlayerPortrait.jsx";
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
function Player({ id }) {
  const p = byPlayer.get(Number(id));
  return (
    <span className="portrait-label">
      <PlayerPortrait player={p} />
      {p?.name || "Unknown player"}
      {p && <PitcherPriorityBadge player={p} record={playerData.players[p.id]}/>} 
    </span>
  );
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
    [now, setNow] = useState(Date.now());
  const season = seasons.find((s) => s.id === selected) || seasons[0] || null;
  async function refresh() {
    if (!supabase) return;
    const r = await supabase.rpc("ssl_seasons");
    if (r.error) {
      setError(r.error.message);
      return;
    }
    setSeasons(r.data || []);
    setError("");
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
    const t = setInterval(() => setNow(Date.now()), 1000);
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
    now,
    act,
    refresh,
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
    [dates, setDates] = useState(["", ""]),
    [deadline, setDeadline] = useState(""),
    [draft, setDraft] = useState(""),
    [lotteryMins, setLotteryMins] = useState(20),
    [finish, setFinish] = useState({ champion: "", finalist: "" }),
    [tab, setTab] = useState("Season Setup");
  useEffect(
    () => setSlots(s?.teams?.map((t) => t.slot) || []),
    [s?.id, s?.teams?.length],
  );
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
                  Registered teams are managed in Team Setup. All 12 need a team name, home location, logo, and conference selection before you can open the draft-date poll.
                </p>
                <p role="status"><strong>{registeredTeams.length}/12 teams registered.</strong> {registeredTeams.length < 12 ? `Waiting on ${12-registeredTeams.length} more team${12-registeredTeams.length===1?'':'s'} before draft-day voting can open.` : 'All teams registered! You can select them and open the draft-date poll.'}</p>
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
              {["setup", "poll"].includes(s.status) && (
                <Box title="DRAFT-DATE POLL">
                  <form
                    className="season-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      l.act("poll", {
                        options: dates
                          .filter(Boolean)
                          .map((d, i) => ({ id: String(i + 1), date: iso(d) })),
                        closesAt: iso(deadline),
                      });
                    }}
                  >
                    <p>
                      One vote per franchise, including accounts sharing a GM
                      code. Times are entered in your device’s timezone and
                      displayed in Eastern Time.
                    </p>
                    {dates.map((d, i) => (
                      <label key={i}>
                        Option {i + 1}
                        <input
                          required
                          type="datetime-local"
                          value={d}
                          onChange={(e) =>
                            setDates((a) =>
                              a.map((x, j) => (j === i ? e.target.value : x)),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="outline-btn"
                      disabled={dates.length >= 12}
                      onClick={() => setDates((x) => [...x, ""])}
                    >
                      ADD DATE OPTION
                    </button>
                    <label>
                      Voting deadline
                      <input
                        required
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </label>
                    <button
                      className="red-btn"
                      disabled={l.busy || s.teams.length !== 12 || !s.conferencesSet}
                    >
                      OPEN / REPLACE POLL
                    </button>
                  </form>
                </Box>
              )}
              {["poll", "scheduled"].includes(s.status) && (
                <>
                  <Voting league={l} />
                  <Box title="CONFIRM DRAFT DATE">
                    <form
                      className="season-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        l.act("schedule_draft", {
                          draftAt: iso(draft),
                          lotteryAt: new Date(
                            new Date(draft).getTime() - lotteryMins * 60000,
                          ).toISOString(),
                        });
                      }}
                    >
                      <label>
                        Official draft date and time
                        <input
                          required
                          type="datetime-local"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                      </label>
                      <label>
                        Lottery minutes before draft
                        <input
                          type="number"
                          min={15}
                          max={30}
                          required
                          value={lotteryMins}
                          onChange={(e) =>
                            setLotteryMins(Number(e.target.value))
                          }
                        />
                      </label>
                      <button className="red-btn" disabled={l.busy}>
                        SET DRAFT DATE
                      </button>
                      <p>
                        The room opens an hour early. Lottery order is generated
                        once at the selected time and cannot be rerolled by
                        refreshing.
                      </p>
                    </form>
                  </Box>
                </>
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
                          {s.teams.map((t) => (
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
        {s?.teams.map((t) => (
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
function Voting({ league: l }) {
  const s = l.season,
    [team, setTeam] = useActingTeam(l);
  if (!s?.poll)
    return (
      <Box title="VOTING CLOSED">
        <p>
          The commissioner will open a draft-date poll after selecting 12 teams.
        </p>
      </Box>
    );
  const open = s.status === "poll" && l.now < new Date(s.poll.closesAt);
  return (
    <Box title={open ? "DRAFT-DATE VOTE" : "DRAFT-DATE VOTE CLOSED"}>
      <p>Deadline: {time(s.poll.closesAt)} · one vote per team.</p>
      {l.access.role === "commissioner" && (
        <TeamChooser s={s} value={team} onChange={setTeam} />
      )}
      <div className="season-options">
        {s.poll.options.map((o) => (
          <div key={o.id}>
            <strong>{time(o.date)}</strong>
            <span>
              {
                Object.values(s.poll.votes || {}).filter((v) => v === o.id)
                  .length
              }{" "}
              votes
            </span>
            {team && open && (
              <button
                className="outline-btn"
                disabled={l.busy}
                onClick={() => l.act("vote", { team, option: o.id })}
              >
                {s.poll.votes[team] === o.id
                  ? "YOUR VOTE"
                  : "VOTE FOR THIS DATE"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Box>
  );
}
function Draft({ league: l }) {
  const s = l.season,
    [reveal, setReveal] = useState(0);
  useEffect(() => {
    if (!s?.order?.length) return;
    setReveal(0);
    const t = setInterval(
      () => setReveal((x) => Math.min(s.order.length, x + 1)),
      1600,
    );
    return () => clearInterval(t);
  }, [s?.id, s?.order?.length]);
  if (!s)
    return (
      <>
        <NextSeason league={l} />
        <Box title="DRAFT NOT SCHEDULED">
          <p>The commissioner needs to set up the season first.</p>
        </Box>
      </>
    );
  const open = s.draftAt && l.now >= new Date(s.draftAt).getTime() - 3600000,
    next = s.picks.length,
    owner = s.nextPick?.team,
    t = s.teams.find((t) => t.id === owner),
    mine = l.access.role === "commissioner" || l.myTeam?.id === owner;
  if (!open)
    return (
      <>
        <NextSeason league={l} />
        <Box title="DRAFT ROOM OPENS ONE HOUR EARLY">
          <p>
            Draft: {time(s.draftAt)}
            <br />
            Room opens:{" "}
            {s.draftAt
              ? time(new Date(new Date(s.draftAt).getTime() - 3600000))
              : "Date to be announced"}
            <br />
            Lottery: {time(s.lotteryAt)}
          </p>
        </Box>
      </>
    );
  return (
    <>
      <NextSeason league={l} />
      <SeasonCalendar league={l} />
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
        {s.number>1 && <p>Returning-season lottery: 12th seed 55% · 11th 25% · 10th 15% · 9th 5% for first pick. Winners are removed before the next weighted draw. Seeds 8 through 1 receive picks 5 through 12, then the order snakes.</p>}
        <details className="draft-order-details" open={s.status === "scheduled"}><summary>DRAFT ORDER · {s.order.length || 12} TEAMS</summary>
        {!s.order.length ? (
          <p>Waiting for the scheduled lottery time.</p>
        ) : (
          <>
            <div className="lottery-reveal lottery-reveal-bingo">
              <div className="bingo-machine" role="img" aria-label="Rotating draft lottery bingo cage with every franchise's logo on a ball">
                <div className={`bingo-drum ${reveal<s.order.length?'bingo-drum-spinning':'bingo-drum-stopped'}`}>
                  {s.teams.filter(t=>!s.order.slice(0,reveal).includes(t.id)).map((team,i,remaining)=>(
                    <span key={team.id} className="bingo-cage-ball" style={{'--ball-angle':`${i*360/Math.max(remaining.length,1)}deg`}} title={team.name}>
                      {team.logoPath&&<img alt="" src={teamLogo(l.supabase,team.logoPath)}/>}
                    </span>
                  ))}
                </div>
                <div className="bingo-crank" aria-hidden="true"/>
                <div className="bingo-machine-base" aria-hidden="true"/>
              </div>
              <div className="bingo-announcement" aria-live="polite">
                <span className="bingo-announcement-heading">{reveal?'BALL DRAWN':'ROTATING THE BINGO CAGE'}</span>
                <span className={`lottery-ball bingo-drawn-ball ${reveal?'bingo-ball-drawn':'bingo-ball-pending'}`}>
                  {reveal>0?(()=>{
                    const team=s.teams.find(t=>t.id===s.order[reveal-1]);
                    return team?.logoPath?<img alt={`${team.name} logo on drawn bingo ball`} src={teamLogo(l.supabase,team.logoPath)}/>:reveal;
                  })():'?'}
                </span>
                <strong>{reveal?`${reveal}. ${s.teams.find(t=>t.id===s.order[reveal-1])?.name}`:'MIXING ALL 12 TEAM LOGO BALLS…'}</strong>
                <small>{reveal>=s.order.length?'DRAFT LOTTERY COMPLETE':`${s.order.length-reveal} balls remaining`}</small>
              </div>
            </div>
            <div className="season-draft-order">
              {s.order.slice(0,reveal).map((id,i)=>{
                const team=s.teams.find(t=>t.id===id);
                return <span key={id} className="lottery-result-team">
                  {team?.logoPath&&<img alt="" src={teamLogo(l.supabase,team.logoPath)}/>}
                  {i+1}. {team?.name}
                </span>;
              })}
            </div>
          </>
        )}
        </details>
        {s.status === "drafting" && (
          <>
            <div className="pick-clock" aria-live="off">
              {clock(elapsed(s, l.now))}
              <small>{s.paused ? "PAUSED" : "ELAPSED · NO TIME LIMIT"}</small>
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
                {s.paused ? "RESUME" : "PAUSE"} DRAFT
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
              {s.teams.map((t) => {
                const p = s.picks.filter((p) => p.team === t.id);
                return (
                  <tr key={t.id}>
                    <td>{t.name}</td>
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
  return <p className="heating-up-status"><strong>★ HEATING UP · Next-game stars:</strong> {ids.length?ids.map(name).join(' · '):'None earned yet'} <small>Automatic from previous game scores of 90+.</small></p>;
}
function HeatingUpPage({league:l}) {
  const season=l.season;
  if(!season)return <Box title="HEATING UP"><p>No season available yet.</p></Box>;
  const heat=heatingUpForSeason(season,{includeRecorded:l.access.role==='commissioner'});
  const entries=Object.entries(heat.players).filter(([,v])=>v.heatingUpCount>0)
    .sort((a,b)=>b[1].heatingUpCount-a[1].heatingUpCount||b[1].longestHotStreak-a[1].longestHotStreak);
  const gameNames=new Map((season.games||[]).map(g=>[g.id,`${season.teams?.find(t=>t.id===g.away)?.name||'Away'} at ${season.teams?.find(t=>t.id===g.home)?.name||'Home'}`]));
  return <>
    <Box title="HEATING UP · SEASON RECORDS">
      <p>A Project Rio Game Score of 90 or higher automatically stars the player for their next team game. Two or more consecutive qualifying games create a hot streak. These are cumulative totals, not per-game averages.</p>
      {entries.length?<div className="season-table"><table><thead><tr><th>Player</th><th>Times Heated Up</th><th>Hot Streaks (2+)</th><th>Longest Streak</th><th>Current Streak</th></tr></thead><tbody>
        {entries.map(([id,r])=><tr key={id}><td><Player id={Number(id)}/></td><td>{r.heatingUpCount}</td><td>{r.hotStreaks}</td><td>{r.longestHotStreak}</td><td>{r.currentHotStreak}</td></tr>)}
      </tbody></table></div>:<p>No official 90+ Game Scores recorded yet.</p>}
    </Box>
    <Box title="HEATING UP · GAME HISTORY">
      {heat.events.length?heat.events.map((e,i)=><p key={e.gameId+'-'+i}><strong>{name(e.playerId)}</strong> · {e.at?new Date(e.at).toLocaleDateString('en-US'):'Date unavailable'} · {gameNames.get(e.gameId)} · Score {e.gameScore} · {e.streak>=2?'HOT STREAK ×'+e.streak:'Heating Up'}{e.starredGame?' · Star next game':''}</p>):<p>Game-by-game Heating Up history appears after official reports are released.</p>}
    </Box>
  </>;
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
      <p className="priority-lineup-help"><strong>Pitcher change priority:</strong> P1P captains first, P2P (7+ pitching) next, otherwise random. This is an SSL planning guide; this website does not change Dolphin AI.</p>
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
      {game ? <HeatingStatus season={s} game={game} team={team} includeRecorded={l.access.role==='commissioner'}/> : <p className="heating-up-help">Players become starred automatically for their next team game after earning a Project Rio Game Score of 90 or higher. No coins, tiers, or manual star selection.</p>}
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
export function RosterManager({ league: l }) {
  const s=l.season;
  const [team,setTeam]=useActingTeam(l);
  const [editDefault,setEditDefault]=useState(false);
  const [editingGame,setEditingGame]=useState(null);
  useEffect(()=>{setEditDefault(false);setEditingGame(null)},[s?.id,team]);
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
      <Box title={`${chosen.name.toUpperCase()} · ROSTER`}>
        <p><strong>{roster.length} players</strong> · {hasDefault?'Default lineup saved':'Default lineup not saved yet'} · {s.status.toUpperCase()}</p>
        {roster.length===0?<p>Players will appear as they are drafted.</p>:<div className="roster-manager-players">{roster.map(id=><div key={id} className="roster-manager-player"><Player id={id}/></div>)}</div>}
      </Box>
      <Box title="DEFAULT LINEUP">
        <p>This lineup is the fallback for every game until you submit a specific game lineup. Changes here do not overwrite a game lineup already submitted.</p>
        {roster.length<11?<p><strong>Draft or acquire at least 11 players before saving a default lineup.</strong></p>:<>
          {hasDefault&&!editDefault&&<div className="roster-lineup-summary">
            <h3>CURRENT DEFAULT BATTING ORDER</h3>
            {defaultLineup.starters.map((p,i)=><p key={p.player}><strong>{i+1}.</strong> <Player id={p.player}/> · {p.position}</p>)}
            <p><strong>Bench:</strong> {defaultLineup.bench.map(name).join(' · ')||'None'}</p>
          </div>}
          {!canEditDefault?<p>Default-lineup editing opens after the draft and closes during the offseason.</p>:<>
            <button type="button" className="outline-btn" onClick={()=>setEditDefault(v=>!v)} aria-expanded={editDefault}>{editDefault?'CANCEL DEFAULT LINEUP EDIT':l.access.role==='commissioner'?'EDIT TEAM DEFAULT LINEUP':'EDIT MY DEFAULT LINEUP'}</button>
            {!hasDefault&&!editDefault&&<p>Click the button above to create the required default lineup.</p>}
            {editDefault&&<LineupEditor key={s.id+':'+team+':default'} league={l} team={team} onDone={()=>setEditDefault(false)}/>}
          </>}
        </>}
      </Box>
      <Box title="UPCOMING GAME LINEUPS">
        <p>Select a scheduled game, then submit the nine starters, batting order, defensive positions and bench. Your saved lineup appears automatically in Schedule and replaces the default for that matchup only. You may edit it again until the game is locked by its result upload.</p>
        {!s.schedulePublished?<p><strong>The commissioner must publish the schedule before game-specific lineups can be submitted.</strong></p>:!fixtures.length?<p>No scheduled games for this franchise yet.</p>:<>
          {fixtures.filter(g=>g.stage!=='cancelled').map(g=>{
            const editable=gameLineupIsEditable(s,team,g);
            const opponent=s.teams.find(t=>t.id===(g.away===team?g.home:g.away));
            const existing=effectiveGameLineup(s,team,g);
            const active=editingGame===g.id;
            return <section className="roster-fixture" key={g.id}>
              <div className="roster-fixture-heading">
                <div><h3>{g.away===team?'VS':'AT'} {opponent?.name||'Opponent'}</h3>
                <p>{time(g.startsAt)} · {g.stage.toUpperCase()} · <strong>{savedLineupLabel(s,team,g)}</strong></p></div>
                {editable&&<button type="button" className="outline-btn" aria-expanded={active} onClick={()=>setEditingGame(active?null:g.id)}>{active?'CLOSE EDITOR':g.lineups?.[team]?'EDIT GAME LINEUP':'SUBMIT GAME LINEUP'}</button>}
              </div>
              {!active&&existing?.starters?.length>0&&<details><summary>VIEW LINEUP ON SCHEDULE</summary>{existing.starters.map((p,i)=><p key={i}>{i+1}. {name(p.player)} · {p.position}</p>)}<p><strong>Bench:</strong> {existing.bench?.map(name).join(' · ')||'None'}</p></details>}
              {active&&editable&&<LineupEditor key={s.id+':'+team+':'+g.id} league={l} team={team} game={g} onDone={()=>setEditingGame(null)}/>}
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
  return (
    <div className="season-team-columns">
      {[0, 1].map((col) => (
        <div key={col}>
          {s?.teams
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
                  <small>
                    <ConferenceMark id={t.conference} size={29}/>{conferences[t.conference] || "Conference pending"} ·{" "}
                    {rosterOf(s, t.id).length} players
                  </small>
                </summary>
                {s.defaults[t.id]?.starters.map((p, i) => (
                  <div className="roster-line" key={p.player}>
                    <b>{i + 1}</b>
                    <Player id={p.player} />
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
                      <Player id={p} />
                    </div>
                  ))}
              </details>
            ))}
        </div>
      ))}
    </div>
  );
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
              <small>
                {g.postponed ? "POSTPONED · " : ""}
                {g.label || g.phase} · {g.startsAt?time(g.startsAt):"DATE & TIME TBD"}
              </small>
              <h3>
                {s.teams.find((t) => t.id === g.away)?.name} <b>AT</b>{" "}
                {s.teams.find((t) => t.id === g.home)?.name}
              </h3>
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
        Map report team labels and any ambiguous Mii/name rows. Include a
        Game Score column in the Project Rio Stats worksheet (0–999.99).
        A score of 90+ automatically grants a star next game. Replacing a
        report recalculates Heating Up records and streaks instead of adding a second game.
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
                  <th>Game Score</th>
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
                      <td><strong>{r.gamescore ?? r.ingamescore ?? '—'}</strong>{Number(r.gamescore ?? r.ingamescore ?? 0)>=90?' ★':''}</td>
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
                  {s.teams.map((t) => (
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
                  <Player id={id} />
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
                <Player id={p.id} />
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
    ],
    s = l.season,
    records = new Map(standings(s).map(t=>[t.id,t]));
  return (
    <Box title="TEAM STAT TOTALS">
      <div className="season-table">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>GP</th>
              <th>Home Record (W–L)</th><th>Away Record (W–L)</th>
              {keys.map((k) => (
                <th key={k}>{k.replace(/([A-Z])/g, " $1")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s?.teams.map((t) => {
              const games = s.games.filter(
                  (g) => g.stage === "final" && [g.away, g.home].includes(t.id),
                ),
                all = games.flatMap((g) =>
                  g.result.players.filter((p) => p.team === t.id),
                );
              return (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{games.length}</td>
                  <td>{records.get(t.id)?.homeWins??0}–{records.get(t.id)?.homeLosses??0}</td>
                  <td>{records.get(t.id)?.awayWins??0}–{records.get(t.id)?.awayLosses??0}</td>
                  {keys.map((k) => (
                    <td key={k}>
                      {all.reduce((n, p) => n + (p.stats[k] || 0), 0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>Home and Away Records count released regular-season games only.</p>
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
            <p>{s.teams.map((t) => t.name).join(" · ")}</p>
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
          {["gamesPlayed", "hits", "homeRuns", "rbi", "pitchStrikeouts"].map(
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
export const seasonPages = [
  "Schedule",
  "Standings",
  "Teams",
  "Team Stats",
  "Heating Up",
  "Transactions",
  "Playoff Bracket",
  "Voting",
  "SSL History",
  "Draft Room",
  "Free Agency",
  "Messages",
];
export function SeasonPage({ page, league: l }) {
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
      ) : page === "Team Stats" ? (
        <TeamStats league={l} />
      ) : page === "Heating Up" ? (
        <HeatingUpPage league={l} />
      ) : page === "Voting" ? (
        <>
          <PublicBallots league={l} />
          <Voting league={l} />
        </>
      ) : page === "Draft Room" ? (
        <Draft league={l} />
      ) : page === "Free Agency" ? (
        <FreeAgency league={l} />
      ) : page === "SSL History" ? (
        <History league={l} />
      ) : page === "Playoff Bracket" ? (
        l.season &&
        ["postseason", "retention", "offseason", "archived"].includes(
          l.season.status,
        ) ? (
          <>
            <PlayoffPanel league={l} />
            <Schedule
              league={{
                ...l,
                season: {
                  ...l.season,
                  games: l.season.games.filter((g) => g.phase === "playoffs"),
                },
              }}
            />
          </>
        ) : (
          <Box title="PLAYOFFS CLOSED">
            <p>Opens after the regular season.</p>
          </Box>
        )
      ) : (
        <Trades league={l} messages={page === "Messages"} />
      )}
    </>
  );
}
export function SeasonTeamTools({ league, section='Roster' }) {
  return <>
    <SeasonSelector league={league}/>
    <SeasonFeedback league={league}/>
    {section==='Roster'&&<RosterManager league={league}/>}
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
    </div>
  );
}
