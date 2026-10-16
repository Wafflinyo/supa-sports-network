import React, { useState, useEffect, useMemo } from "react";
import pool from "./players.json";
import { teamLogo } from "./TeamIdentity.jsx";
import { PlayerPortrait } from "./PlayerPortrait.jsx";
import {
  rosterOf,
  validLineup,
  positions,
  elapsed,
  clock,
  standings,
  aggregate,
  readRio,
  buildReport,
} from "./season-data.js";
import "./season.css";
const byPlayer = new Map(pool.map((p) => [p.id, p]));
const time = (v) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(new Date(v)) + " ET"
    : "Not set";
const iso = (v) => new Date(v).toISOString();
const name = (id) => byPlayer.get(Number(id))?.name || "Unknown player";
function Player({ id }) {
  const p = byPlayer.get(Number(id));
  return (
    <span className="portrait-label">
      <PlayerPortrait player={p} />
      {p?.name || "Unknown player"}
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
      setNotice("Saved.");
      return true;
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
    needs = s.needsDefault?.includes(t.id),
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
          <button className="red-btn" onClick={() => go("Team Tools")}>
            SET DEFAULT LINEUP
          </button>
        </>
      ) : upcoming ? (
        <>
          <p>
            Submit a lineup for your upcoming game on {time(upcoming.startsAt)},
            or choose your default.
          </p>
          <button className="red-btn" onClick={() => go("Schedule")}>
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
    "Lineups",
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
                  l.busy || l.seasons.some((s) => s.status !== "archived")
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
                  Registered teams are managed in Team Setup. Select all 12
                  before opening the draft-date vote.
                </p>
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
                    <p>{slots.length}/12 selected</p>
                    <button
                      className="red-btn"
                      disabled={l.busy}
                      onClick={() => l.act("teams", { slots })}
                    >
                      SAVE SEASON TEAMS
                    </button>
                  </>
                ) : (
                  <p>{s.teams.length} teams · 11-round snake draft</p>
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
                      disabled={l.busy || s.teams.length !== 12}
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
                    retention and grants three unused one-season extension
                    contracts to every franchise.
                  </p>
                  <form
                    className="season-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      l.act("finish", finish);
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
                    <button className="red-btn" disabled={l.busy}>
                      COMPLETE SEASON & OPEN EXTENSIONS
                    </button>
                  </form>
                </Box>
              )}
              {s.status === "retention" && (
                <Box title="ARCHIVE SEASON">
                  <p>
                    Finish extension decisions first. Unused contracts carry
                    over; accepted extensions reserve players for next season.
                    Eleven new draft picks remain in addition to retained
                    players.
                  </p>
                  <button
                    className="red-btn"
                    disabled={l.busy}
                    onClick={() => l.act("archive")}
                  >
                    CLOSE RETENTION & ARCHIVE
                  </button>
                </Box>
              )}
            </>
          )}
        </>
      )}
      {tab === "Draft" && <Draft league={l} />}
      {tab === "Schedule & Results" && <Schedule league={l} commissioner />}
      {tab === "Lineups" && <MyTeam league={l} />}
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
    [chosen, setChosen] = useState(""),
    [query, setQuery] = useState(""),
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
      <Box title="DRAFT NOT SCHEDULED">
        <p>The commissioner needs to set up the season first.</p>
      </Box>
    );
  const open = s.draftAt && l.now >= new Date(s.draftAt).getTime() - 3600000,
    next = s.picks.length,
    original =
      s.order?.[Math.floor(next / 12) % 2 ? 11 - (next % 12) : next % 12],
    owner =
      s.number === 1
        ? original
        : (s.currentPickAssets || []).find(
            (a) =>
              a.originalTeam === original &&
              a.round === Math.floor(next / 12) + 1,
          )?.owner || original,
    t = s.teams.find((t) => t.id === owner),
    mine = l.access.role === "commissioner" || l.myTeam?.id === owner,
    used = new Set(Object.values(s.rosters).flat()),
    available = pool.filter(
      (p) =>
        !used.has(p.id) && p.name.toLowerCase().includes(query.toLowerCase()),
    );
  if (!open)
    return (
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
    );
  return (
    <>
      <Box
        title={
          s.status === "drafting"
            ? `ON THE CLOCK: ${t?.name || ""}`
            : s.picks.length === 132
              ? "DRAFT SUMMARY"
              : "DRAFT LOTTERY"
        }
      >
        <p>
          Draft begins {time(s.draftAt)} · lottery {time(s.lotteryAt)} · 11
          rounds · snake order
        </p>
        {!s.order.length ? (
          <p>Waiting for the scheduled lottery time.</p>
        ) : (
          <>
            <div className="lottery-reveal">
              <span className="lottery-ball">{reveal < 12 ? "★" : 12}</span>
              {reveal > 0 &&
                s.teams.find((t) => t.id === s.order[reveal - 1])?.logoPath && (
                  <img
                    alt=""
                    src={teamLogo(
                      l.supabase,
                      s.teams.find((t) => t.id === s.order[reveal - 1])
                        .logoPath,
                    )}
                  />
                )}
              <strong>
                {reveal
                  ? `${reveal}. ${s.teams.find((t) => t.id === s.order[reveal - 1])?.name}`
                  : "MIXING THE BINGO BALLS…"}
              </strong>
            </div>
            <div className="season-draft-order">
              {s.order.slice(0, reveal).map((id, i) => (
                <span key={id}>
                  {i + 1}. {s.teams.find((t) => t.id === id)?.name}
                </span>
              ))}
            </div>
          </>
        )}
        {s.status === "drafting" && (
          <>
            <div className="pick-clock" aria-live="off">
              {clock(elapsed(s, l.now))}
              <small>{s.paused ? "PAUSED" : "ELAPSED · NO TIME LIMIT"}</small>
            </div>
            <p>
              Round {Math.floor(next / 12) + 1} · Pick {next + 1}/132
            </p>
            {mine && !s.paused ? (
              <div className="season-inline">
                <input
                  aria-label="Search draft players"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search available players"
                />
                <select
                  aria-label="Draft player"
                  value={chosen}
                  onChange={(e) => setChosen(e.target.value)}
                >
                  <option value="">Select player</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.class}
                    </option>
                  ))}
                </select>
                <button
                  className="red-btn"
                  disabled={l.busy || !chosen}
                  onClick={async () => {
                    if (await l.act("pick", { player: Number(chosen) }))
                      setChosen("");
                  }}
                >
                  SUBMIT PICK
                  {l.access.role === "commissioner" ? " / PICK FOR TEAM" : ""}
                </button>
              </div>
            ) : (
              <p>Waiting for {t?.name} to pick.</p>
            )}
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
        {s.picks.length === 132 && (
          <p>
            Draft complete. Review each roster below, then open Team Tools to
            save your starting nine, batting order, positions and bench.
          </p>
        )}
      </Box>
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
        <details>
          <summary>ALL DRAFT PICKS ({s.picks.length})</summary>
          <div className="season-table">
            <table>
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Round</th>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {s.picks.map((p) => (
                  <tr key={p.number}>
                    <td>{p.number}</td>
                    <td>{p.round}</td>
                    <td>{s.teams.find((t) => t.id === p.team)?.name}</td>
                    <td>
                      <Player id={p.player} />
                    </td>
                    <td>{clock(p.seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Box>
      <Teams league={l} />
    </>
  );
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
    [team, game?.id],
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
      <h4>BENCH</h4>
      <p>
        {lineup.bench.map(name).join(" · ") ||
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
function MyTeam({ league: l }) {
  const [team, setTeam] = useActingTeam(l);
  return (
    <>
      {l.access.role === "commissioner" && (
        <TeamChooser s={l.season} value={team} onChange={setTeam} />
      )}
      <Box title="ROSTER & DEFAULT LINEUP">
        {!l.season || !team ? (
          <p>Select your season team to manage its roster.</p>
        ) : rosterOf(l.season, team).length < 11 ? (
          <p>
            Your team needs {11 - rosterOf(l.season, team).length} more players.
            Visit Free Agency or use Random Fill.
          </p>
        ) : (
          <LineupEditor key={team} league={l} team={team} />
        )}
      </Box>
    </>
  );
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
                  <small>{rosterOf(s, t.id).length} players</small>
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
    games = [...s.games].sort(
      (a, b) => new Date(a.startsAt) - new Date(b.startsAt),
    );
  return (
    <>
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
              disabled={l.busy || !s.games.length}
              onClick={() => l.act("publish_schedule")}
            >
              PUBLISH SCHEDULE
            </button>
          </form>
          <p>
            {s.schedulePublished
              ? "Schedule is public."
              : "Schedule is a commissioner-only draft until published."}
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
        games.map((g) => (
          <section className="panel season-game" key={g.id}>
            <div>
              <small>
                {g.label || g.phase} · {time(g.startsAt)}
              </small>
              <h3>
                {s.teams.find((t) => t.id === g.away)?.name} <b>AT</b>{" "}
                {s.teams.find((t) => t.id === g.home)?.name}
              </h3>
              <strong>
                {g.stage === "final"
                  ? `${g.result.scores[g.away]} – ${g.result.scores[g.home]}`
                  : g.stage.toUpperCase()}
              </strong>
            </div>
            {team &&
              [g.away, g.home].includes(team) &&
              g.stage === "scheduled" &&
              l.now < new Date(g.startsAt) && (
                <button
                  className="outline-btn"
                  onClick={() => setEditing(editing === g.id ? null : g.id)}
                >
                  {g.lineups[team] ? "EDIT SUBMITTED" : "SUBMIT"} LINEUP
                </button>
              )}
            {admin && (
              <div className="season-inline">
                {g.stage === "scheduled" ? (
                  <button
                    className="red-btn"
                    disabled={
                      l.busy || !["regular", "postseason"].includes(s.status)
                    }
                    onClick={() => l.act("start_game", { game: g.id })}
                  >
                    MARK GAME STARTED & LOCK LINEUPS
                  </button>
                ) : (
                  <button
                    className="red-btn"
                    onClick={() =>
                      setReportGame(reportGame === g.id ? null : g.id)
                    }
                  >
                    {g.stage === "final"
                      ? "REPLACE / CORRECT RESULT"
                      : "UPLOAD PROJECT RIO XLSX"}
                  </button>
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
        Map report team labels and any ambiguous Mii/name rows. Review before
        posting. Replacing a report recalculates totals instead of adding a
        second game.
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
            POST VERIFIED RESULT
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
        : m.kind === "contract"
          ? `${m.quantity} unused extension contract(s)`
          : (() => {
              const a = s.pickAssets.find((p) => p.id === m.id);
              return `S${s.number + 1} · Round ${a?.round || "?"} · ${teamName(a?.originalTeam)}`;
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
          <Box title={messages ? "TRADE MESSAGES" : "PROPOSE A TRADE"}>
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
                  commissioner approval. Keep at least nine next-season picks.
                  Rosters below 11 must be filled immediately after the trade.
                </p>
                <div className="season-team-checks">
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
                      value={move.kind}
                      onChange={(e) =>
                        setMove({ ...move, kind: e.target.value, id: "" })
                      }
                    >
                      <option value="player">Player</option>
                      <option value="pick">Next-season draft pick</option>
                      <option value="contract">
                        Unused extension contract
                      </option>
                    </select>
                  </label>
                  {move.kind === "contract" ? (
                    <label>
                      Contracts
                      <input
                        type="number"
                        min="1"
                        max={
                          s.contractBalances.find((x) => x.team === move.from)
                            ?.tokens || 0
                        }
                        value={move.quantity}
                        onChange={(e) =>
                          setMove({ ...move, quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                  ) : (
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
                  )}
                  <button
                    className="outline-btn"
                    disabled={
                      !move.from ||
                      !move.to ||
                      move.from === move.to ||
                      (move.kind !== "contract" && !move.id)
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
                Trading opens after the draft and all teams save valid default
                lineups.
              </p>
            )}
          </Box>
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
function Extensions({ league: l }) {
  const s = l.season,
    [team, setTeam] = useActingTeam(l),
    [player, setPlayer] = useState("");
  if (!s)
    return (
      <Box title="EXTENSIONS">
        <p>No season yet.</p>
      </Box>
    );
  const repeats =
      s.extensionHistory?.find(
        (h) => h.franchise === team && h.player === Number(player),
      )?.accepted || 0,
    rank = standings(s),
    bonus =
      s.champion === team
        ? 20
        : s.finalist === team
          ? 15
          : s.games.some(
                (g) =>
                  g.phase === "playoffs" && [g.away, g.home].includes(team),
              )
            ? 10
            : 0,
    penalty = rank.at(-1)?.id === team ? 10 : 0,
    chance = !repeats
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            ([85, 70, 50, 25][repeats - 1] ?? 15) + bonus - penalty,
          ),
        ),
    balance = s.contractBalances?.find((x) => x.team === team)?.tokens || 0;
  return (
    <Box title="ONE-SEASON EXTENSION CONTRACTS">
      <p>
        Three contracts per franchise after each championship. Unused contracts
        carry over and may be traded. A rejected offer still consumes a
        contract. Only accepted extensions advance that franchise’s repeat
        history, which persists through rebrands, GM changes and player
        departures.
      </p>
      <div className="season-table">
        <table>
          <thead>
            <tr>
              <th>Accepted extensions before this offer</th>
              <th>Base acceptance</th>
            </tr>
          </thead>
          <tbody>
            {[
              [0, "100%"],
              [1, "85%"],
              [2, "70%"],
              [3, "50%"],
              [4, "25%"],
              ["5+", "15%"],
            ].map(([n, c]) => (
              <tr key={n}>
                <td>{n}</td>
                <td>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Highest finish bonus only: playoffs +10, finalist +15, champion +20
        percentage points (maximum 100%). Last in regular-season standings: −10.
        The first extension is guaranteed. One offer per player and franchise
        each offseason.
      </p>
      {l.access.role === "commissioner" && (
        <TeamChooser
          s={s}
          value={team}
          onChange={(v) => {
            setTeam(v);
            setPlayer("");
          }}
        />
      )}
      {team && (
        <>
          <h3>
            {balance} UNUSED CONTRACT{balance === 1 ? "" : "S"}
          </h3>
          {s.status === "retention" ? (
            <>
              <label>
                Player
                <select
                  value={player}
                  onChange={(e) => setPlayer(e.target.value)}
                >
                  <option value="">Choose player</option>
                  {rosterOf(s, team)
                    .filter(
                      (id) =>
                        !s.extensionOffers.some(
                          (o) => o.franchise === team && o.player === id,
                        ),
                    )
                    .map((id) => (
                      <option key={id} value={id}>
                        {name(id)}
                      </option>
                    ))}
                </select>
              </label>
              {player && (
                <p>
                  {repeats} prior accepted extension(s) with this franchise ·{" "}
                  {chance}% acceptance chance.
                </p>
              )}
              <button
                className="red-btn"
                disabled={l.busy || !player || balance < 1}
                onClick={async () => {
                  if (
                    confirm(
                      `Spend one contract on ${name(player)}? Acceptance chance: ${chance}%. Rejection also uses the contract.`,
                    ) &&
                    (await l.act("extension", { team, player: Number(player) }))
                  )
                    setPlayer("");
                }}
              >
                OFFER ONE-SEASON EXTENSION
              </button>
            </>
          ) : (
            <p>Extension offers open after the championship series finishes.</p>
          )}
        </>
      )}
      <div className="season-table">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Franchise</th>
              <th>Chance</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {s.extensionOffers?.map((o) => (
              <tr key={o.franchise + o.player}>
                <td>
                  <Player id={o.player} />
                </td>
                <td>{s.teams.find((t) => t.id === o.franchise)?.name}</td>
                <td>{o.chance}%</td>
                <td>
                  {o.accepted
                    ? "SIGNED FOR NEXT SEASON"
                    : "DECLINED · CONTRACT CONSUMED"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
function FreeAgency({ league: l }) {
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
          Minimum roster: 11 players. Following a trade that leaves fewer than
          11, sign free agents or randomly fill the exact number needed, then
          update your default lineup.
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
                    onClick={() => l.act("add_player", { team, player: p.id })}
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
  return (
    <Box title="REGULAR-SEASON STANDINGS">
      <div className="season-table">
        <table>
          <thead>
            <tr>
              {["Team", "GP", "W", "L", "Win %", "RF", "RA", "Diff"].map(
                (x) => (
                  <th key={x}>{x}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {standings(l.season).map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.wins + t.losses}</td>
                <td>{t.wins}</td>
                <td>{t.losses}</td>
                <td>{t.pct.toFixed(3)}</td>
                <td>{t.runsFor}</td>
                <td>{t.runsAgainst}</td>
                <td>{t.runsFor - t.runsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Ordered by winning percentage, then run differential, then franchise
        slot. Regular-season results only.
      </p>
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
    s = l.season;
  return (
    <Box title="TEAM STAT TOTALS">
      <div className="season-table">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>GP</th>
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
                  {name(p.player)}
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
  "Transactions",
  "SSL Playoffs",
  "Voting",
  "SSL History",
  "SSL Draft Room",
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
      ) : page === "Voting" ? (
        <Voting league={l} />
      ) : page === "SSL Draft Room" ? (
        <Draft league={l} />
      ) : page === "Free Agency" ? (
        <FreeAgency league={l} />
      ) : page === "SSL History" ? (
        <History league={l} />
      ) : page === "SSL Playoffs" ? (
        l.season &&
        ["postseason", "retention", "archived"].includes(l.season.status) ? (
          <>
            <p>Playoff games and series are entered by the commissioner.</p>
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
export function SeasonTeamTools({ league }) {
  return (
    <>
      <SeasonSelector league={league} />
      <SeasonFeedback league={league} />
      <MyTeam league={league} />
      <Extensions league={league} />
    </>
  );
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
          {s.teams.length} teams · {s.picks.length}/132 draft picks
        </p>
        <button
          className="outline-btn"
          onClick={() =>
            go(s.status === "drafting" ? "SSL Draft Room" : "Schedule")
          }
        >
          OPEN {s.status === "drafting" ? "DRAFT ROOM" : "SCHEDULE"}
        </button>
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
