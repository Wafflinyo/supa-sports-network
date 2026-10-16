import { PlayerPortrait } from "./PlayerPortrait.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, LockKeyhole, Search, Trophy } from "lucide-react";
import {
  matchupPairs,
  matchupScore,
  previousWeek,
  rules,
  sumScores,
  weekKey,
  fantasySeasonWindow,
  fantasySeasonReady,
  eligibleFantasyGames,
} from "./fantasy-scoring.js";

const tabs = [
  "Matchups",
  "Schedule",
  "Standings",
  "Player Stats",
  "Free Agency",
  "Draft",
];
const labels = {
  rbi: "RBI",
  hrAllowed: "Home runs allowed",
  hitByPitch: "Hit by pitch",
  doublePlaysHitInto: "Hit into double play",
  buddyJumpPutouts: "Buddy jump putout bonus",
  threeInningBonus: "Pitch at least 3 innings",
  completeGameBonus: "Complete game",
  shutoutBonus: "Team shutout bonus",
};
const label = (key) =>
  labels[key] ||
  key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
const points = (n) => `${n > 0 ? "+" : ""}${n}`;
const formatScore = (n) => Number(n || 0).toFixed(2);

export function FantasyRules() {
  return (
    <div className="fantasy-rules panel" id="fantasy-rules">
      <div className="section-title">
        <div>
          <small>LEAGUE HANDBOOK</small>
          <h2>FANTASY RULES & POINT SYSTEM</h2>
        </div>
      </div>
      <div className="rules-content">
        <div className="rules-overview">
          <div>
            <strong>6 / 8 / 10</strong>
            <span>teams per league</span>
          </div>
          <div>
            <strong>10</strong>
            <span>players drafted</span>
          </div>
          <div>
            <strong>7 + 3</strong>
            <span>starters + bench</span>
          </div>
        </div>
        <p>
          Head-to-head matchups run Sunday at 12:00 a.m. through Saturday at
          11:59:59 p.m. Eastern Time. The higher starter point total wins. A
          game belongs to the week in which it starts.
        </p>
        <p>
          Fantasy leagues open after the SSL draft and all twelve rosters are
          complete. Leagues last only through SSL Week 22. Joining midseason
          gives you only the remaining weeks; scoring begins when your fantasy
          draft finishes, with no earlier-game points.
        </p>
        <p>
          The draft is ten rounds with a snake order. All seven starter spots
          are open: a starter earns batting, fielding, and pitching points.
          Every eligible regular-season game they play during the week counts.
          Bench players earn no matchup points.
        </p>
        <p>
          You may swap one starter with one bench player while both are
          unlocked. Uploading an official SSL game report locks its players for
          that premiere’s fantasy week, even while results remain private.
          Points appear after the premiere ends and results release. Lineups
          carry into the next week and unlock Sunday.
        </p>
        <div className="rules-tables">
          {[
            ["Batting", rules.batting],
            ["Fielding", rules.fielding],
            ["Pitching", rules.pitching],
            ["Team bonuses", rules.team],
          ].map(([area, weights]) => (
            <section key={area}>
              <h3>{area}</h3>
              <table>
                <tbody>
                  {Object.entries(weights).map(([key, weight]) => (
                    <tr key={key}>
                      <td>{label(key)}</td>
                      <td>{points(weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <p>
          A team shutout adds +1 point to every player who played for the team
          that allowed zero runs in a finished game. It stacks with other points
          and pitching bonuses. Only fantasy starters contribute to matchup
          totals.
        </p>
        <p className="rules-note">
          Pitching outs are calculated from the report’s innings pitched (three
          outs per inning). The 3-inning bonus is awarded once at nine outs. A
          complete game adds two points when one pitcher handles all of their
          team’s pitching in a finished game. Home runs allowed also count as
          hits allowed. Buddy jump putouts and grand slams add their bonus to
          the ordinary points.
        </p>
      </div>
    </div>
  );
}

export function FantasyLeague({
  initialLeague,
  user,
  supabase,
  players,
  liveGames = [],
  eligibleIds = new Set(),
  sslSeasons = [],
  onLeagueRefresh,
}) {
  const [league, setLeague] = useState(initialLeague);
  const [tab, setTab] = useState("Matchups");
  const [members, setMembers] = useState([]);
  const [order, setOrder] = useState([]);
  const [picks, setPicks] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [draftQuery, setDraftQuery] = useState("");
  const [selectedStarter, setSelectedStarter] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const sslSeason = sslSeasons.find((s) => s.id === league.ssl_season_id);
  const window = fantasySeasonWindow(league, sslSeason, new Date(now));
  const currentWeek = window.viewWeek;
  const games = liveGames.filter(
    (g) => g.seasonId === league.ssl_season_id && g.phase === "regular",
  );
  const seasonEligible = new Set(
    Object.values(sslSeason?.rosters || {}).flat(),
  );
  const eligible = seasonEligible.size ? seasonEligible : eligibleIds;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    setLeague(initialLeague);
    setTab("Matchups");
    setError("");
    setSelectedStarter(null);
  }, [initialLeague.id]);
  useEffect(() => {
    let live = true;
    async function load() {
      const id = initialLeague.id;
      const [l, m, o, p, s] = await Promise.all([
        supabase.from("fantasy_leagues").select("*").eq("id", id).single(),
        supabase
          .from("fantasy_memberships")
          .select("user_id,joined_at,role")
          .eq("league_id", id)
          .order("joined_at"),
        supabase
          .from("fantasy_draft_order")
          .select("user_id,slot")
          .eq("league_id", id)
          .order("slot"),
        supabase
          .from("fantasy_draft_picks")
          .select("pick_number,user_id,player_id,picked_at")
          .eq("league_id", id)
          .order("pick_number"),
        supabase
          .from("fantasy_player_schedule")
          .select("player_id,starts_at,locked_at"),
      ]);
      if (!live) return;
      const failure = [l, m, o, p, s].find((x) => x.error);
      if (failure) {
        setError(failure.error.message);
        return;
      }
      setLeague(l.data);
      setMembers(m.data || []);
      setOrder(o.data || []);
      setPicks(p.data || []);
      setSchedule(s.data || []);
      if (l.data.state === "active") {
        const seeded = await supabase.rpc("ensure_fantasy_week", {
          target_league: id,
        });
        if (seeded.error) {
          if (live) setError(seeded.error.message);
          return;
        }
        const rows = await supabase
          .from("fantasy_week_lineups")
          .select("user_id,week_start,player_id,slot")
          .eq("league_id", id);
        if (live) {
          if (rows.error) setError(rows.error.message);
          else setLineups(rows.data || []);
        }
      }
      if (live) setNow(Date.now());
    }
    load();
    const interval = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [initialLeague.id, supabase, currentWeek]);

  async function run(action) {
    setBusy(true);
    setError("");
    const response = await action();
    setBusy(false);
    if (response.error) {
      setError(response.error.message);
      return;
    }
    await onLeagueRefresh();
    // The polling read follows shortly, but refresh immediately for the acting manager.
    const id = initialLeague.id;
    const [l, p, o, rows] = await Promise.all([
      supabase.from("fantasy_leagues").select("*").eq("id", id).single(),
      supabase
        .from("fantasy_draft_picks")
        .select("pick_number,user_id,player_id,picked_at")
        .eq("league_id", id)
        .order("pick_number"),
      supabase
        .from("fantasy_draft_order")
        .select("user_id,slot")
        .eq("league_id", id)
        .order("slot"),
      supabase
        .from("fantasy_week_lineups")
        .select("user_id,week_start,player_id,slot")
        .eq("league_id", id),
    ]);
    if (l.data) setLeague(l.data);
    if (p.data) setPicks(p.data);
    if (o.data) setOrder(o.data);
    if (l.data?.state === "active") {
      const seeded = await supabase.rpc("ensure_fantasy_week", {
        target_league: id,
      });
      if (seeded.error) setError(seeded.error.message);
      else {
        const currentRows = await supabase
          .from("fantasy_week_lineups")
          .select("user_id,week_start,player_id,slot")
          .eq("league_id", id);
        if (currentRows.data) setLineups(currentRows.data);
      }
    } else if (rows.data) setLineups(rows.data);
    setSelectedStarter(null);
  }

  const teamName = (id) =>
    id === user.id
      ? "You"
      : `Team ${order.find((o) => o.user_id === id)?.slot || members.findIndex((m) => m.user_id === id) + 1}`;
  const myRoster = picks.filter((p) => p.user_id === user.id);
  const mine = lineups.filter(
    (x) => x.user_id === user.id && x.week_start === currentWeek,
  );
  const locked = (playerId) =>
    schedule.some(
      (s) =>
        s.player_id === playerId &&
        weekKey(new Date(s.starts_at)) === currentWeek &&
        s.locked_at &&
        new Date(s.locked_at).getTime() <= now,
    );
  const drafted = new Set(picks.map((p) => p.player_id));
  const available = players.filter(
    (p) =>
      !drafted.has(p.id) &&
      eligible.has(p.id) &&
      `${p.name} ${p.class}`.toLowerCase().includes(draftQuery.toLowerCase()),
  );
  const managerCount = order.length;
  const nextPick = picks.length + 1;
  const roundIndex = managerCount
    ? Math.floor((nextPick - 1) / managerCount)
    : 0;
  const turnSlot = managerCount
    ? roundIndex % 2
      ? managerCount - ((nextPick - 1) % managerCount)
      : ((nextPick - 1) % managerCount) + 1
    : 0;
  const turnUser = order.find((x) => x.slot === turnSlot)?.user_id;
  const firstWeek = window.firstWeek;
  const scoringGames = eligibleFantasyGames(
    league,
    sslSeason,
    games,
    new Date(now),
  );
  const round = Math.max(
    0,
    Math.round(
      (Date.parse(`${currentWeek}T12:00:00Z`) -
        Date.parse(`${firstWeek}T12:00:00Z`)) /
        604800000,
    ),
  );
  const pairs = matchupPairs(
    order.map((x) => x.user_id),
    round,
  );
  const weekLineups = lineups.filter((x) => x.week_start === currentWeek);
  const gameCount = scoringGames.filter(
    (g) =>
      weekKey(new Date(g.startsAt)) === currentWeek &&
      Object.keys(g.playerScores).length,
  ).length;
  const completedWeeks = window.weeks.filter(
    (week) =>
      (week < weekKey(new Date(now)) || window.finished) &&
      scoringGames.some(
        (g) =>
          weekKey(new Date(g.startsAt)) === week &&
          Object.keys(g.playerScores).length,
      ) &&
      !scoringGames.some(
        (g) =>
          weekKey(new Date(g.startsAt)) === week &&
          !Object.keys(g.playerScores).length,
      ),
  );
  const records = new Map(
    order.map((o) => [o.user_id, { wins: 0, losses: 0, ties: 0, points: 0 }]),
  );
  for (const week of completedWeeks) {
    const weekRound = Math.round(
      (Date.parse(`${week}T12:00:00Z`) - Date.parse(`${firstWeek}T12:00:00Z`)) /
        604800000,
    );
    for (const [a, b] of matchupPairs(
      order.map((o) => o.user_id),
      weekRound,
    )) {
      const aScore = matchupScore(
        lineups.filter((x) => x.week_start === week && x.user_id === a),
        scoringGames,
        week,
      );
      const bScore = matchupScore(
        lineups.filter((x) => x.week_start === week && x.user_id === b),
        scoringGames,
        week,
      );
      const aRecord = records.get(a),
        bRecord = records.get(b);
      aRecord.points += aScore;
      bRecord.points += bScore;
      if (aScore === bScore) {
        aRecord.ties++;
        bRecord.ties++;
      } else {
        records.get(aScore > bScore ? a : b).wins++;
        records.get(aScore > bScore ? b : a).losses++;
      }
    }
  }

  return (
    <>
      <div className="fantasy-title">
        <div>
          <small>FANTASY LEAGUE</small>
          <h2>{league.name}</h2>
        </div>
        <div className="invite">
          INVITE CODE <strong>{league.invite_code}</strong>
        </div>
      </div>
      <p className="fantasy-hint">
        {sslSeason?.name || "SSL season pending"} · {window.weeks.length}{" "}
        regular-season matchup weeks ·{" "}
        {window.finished
          ? "REGULAR SEASON COMPLETE"
          : sslSeason?.weekOne
            ? `${window.firstWeek} through ${window.lastWeek}`
            : "Waiting for the SSL calendar"}
        . Earlier games and playoffs do not count.
      </p>
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
      {error && (
        <p className="inline-message" role="alert">
          {error}
        </p>
      )}
      {tab === "Draft" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>Fantasy draft room</h3>
            <span>
              {members.length} / {league.team_limit ?? 8} managers · 10 rounds ·
              snake draft
            </span>
          </div>
          {league.state === "waiting" && (
            <div className="draft-callout">
              <p>
                Invite exactly {league.team_limit ?? 8} managers. The
                commissioner starts the draft when everyone is in. Order follows
                join order and reverses each round.
              </p>
              {league.owner_id === user.id && (
                <button
                  className="red-btn"
                  disabled={
                    busy ||
                    members.length !== (league.team_limit ?? 8) ||
                    !fantasySeasonReady(sslSeason)
                  }
                  onClick={() =>
                    run(() =>
                      supabase.rpc("start_fantasy_draft", {
                        target_league: league.id,
                      }),
                    )
                  }
                >
                  START DRAFT
                </button>
              )}
              {members.length < (league.team_limit ?? 8) && (
                <small>
                  {(league.team_limit ?? 8) - members.length} more manager
                  {(league.team_limit ?? 8) - members.length === 1 ? "" : "s"}{" "}
                  needed.
                </small>
              )}
            </div>
          )}
          {league.state !== "waiting" && (
            <>
              <div className="draft-callout">
                <strong>
                  {league.state === "active"
                    ? "Draft complete"
                    : `Round ${roundIndex + 1}, pick ${nextPick} of ${managerCount * 10}`}
                </strong>
                {league.state === "drafting" && (
                  <span>
                    {turnUser === user.id
                      ? "Your pick is on the clock"
                      : `${teamName(turnUser)} is picking`}
                  </span>
                )}
              </div>
              <div className="draft-layout">
                <div>
                  <div className="draft-search">
                    <Search size={18} />
                    <input
                      placeholder="Search available players"
                      aria-label="Search available players"
                      value={draftQuery}
                      onChange={(e) => setDraftQuery(e.target.value)}
                    />
                  </div>
                  <div className="draft-pool">
                    {available.map((player) => (
                      <div key={player.id} className="draft-player">
                        <div className="portrait-label">
                          <PlayerPortrait player={player} />
                          <div>
                            <strong>{player.name}</strong>
                            <small>
                              {player.class} · #{player.id}
                            </small>
                          </div>
                        </div>
                        <button
                          disabled={
                            busy ||
                            league.state !== "drafting" ||
                            turnUser !== user.id
                          }
                          onClick={() =>
                            run(() =>
                              supabase.rpc("make_fantasy_pick", {
                                target_league: league.id,
                                chosen_player: player.id,
                              }),
                            )
                          }
                        >
                          DRAFT
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="draft-board">
                  <h4>Your roster ({myRoster.length}/10)</h4>
                  {myRoster.map((pick, i) => (
                    <p key={pick.pick_number}>
                      {i + 1}. {byId.get(pick.player_id)?.name}
                    </p>
                  ))}
                  <h4>All picks</h4>
                  <div className="pick-history">
                    {[...picks].reverse().map((p) => (
                      <p key={p.pick_number}>
                        #{p.pick_number} {teamName(p.user_id)} ·{" "}
                        {byId.get(p.player_id)?.name}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {tab === "Matchups" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>This week’s matchups</h3>
            <span>Sunday–Saturday · Eastern Time</span>
          </div>
          {league.state !== "active" ? (
            <p className="fantasy-hint">
              Finish the fantasy draft to start weekly matchups.
            </p>
          ) : (
            <>
              <div className="matchup-grid">
                {pairs.map(([a, b]) => (
                  <div className="matchup-card" key={a}>
                    <span>{teamName(a)}</span>
                    <strong>
                      {formatScore(
                        matchupScore(
                          weekLineups.filter((x) => x.user_id === a),
                          scoringGames,
                          currentWeek,
                        ),
                      )}
                    </strong>
                    <b>VS</b>
                    <strong>
                      {formatScore(
                        matchupScore(
                          weekLineups.filter((x) => x.user_id === b),
                          scoringGames,
                          currentWeek,
                        ),
                      )}
                    </strong>
                    <span>{teamName(b)}</span>
                  </div>
                ))}
              </div>
              <p className="fantasy-hint">
                {gameCount
                  ? `${gameCount} scored game${gameCount === 1 ? "" : "s"} this week.`
                  : "No official games have been scored this week."}{" "}
                Points update when an official game report is uploaded.
              </p>
              <div className="fantasy-section-head">
                <h3>Your lineup</h3>
                <span>
                  Choose a starter, then an unlocked bench player to swap
                </span>
              </div>
              <div className="lineup-grid">
                {[
                  ["starter", "Starters (7)"],
                  ["bench", "Bench (3)"],
                ].map(([slot, title]) => (
                  <section key={slot}>
                    <h4>{title}</h4>
                    {mine
                      .filter((x) => x.slot === slot)
                      .map((row) => (
                        <button
                          key={row.player_id}
                          className={`lineup-player ${selectedStarter === row.player_id ? "chosen" : ""}`}
                          disabled={
                            busy ||
                            window.finished ||
                            locked(row.player_id) ||
                            (slot === "bench" && !selectedStarter)
                          }
                          onClick={() =>
                            slot === "starter"
                              ? setSelectedStarter(row.player_id)
                              : run(() =>
                                  supabase.rpc("swap_fantasy_lineup", {
                                    target_league: league.id,
                                    starter_player: selectedStarter,
                                    bench_player: row.player_id,
                                  }),
                                )
                          }
                        >
                          <span>
                            <PlayerPortrait player={byId.get(row.player_id)} />
                            {byId.get(row.player_id)?.name}
                            <small>
                              {locked(row.player_id) ? (
                                <>
                                  <LockKeyhole size={12} /> Locked this week
                                </>
                              ) : (
                                "Available to swap"
                              )}
                            </small>
                          </span>
                          <strong>
                            {slot === "starter"
                              ? formatScore(
                                  sumScores(
                                    scoringGames,
                                    row.player_id,
                                    currentWeek,
                                  ),
                                )
                              : "BENCH"}
                          </strong>
                        </button>
                      ))}
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {tab === "Schedule" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>Regular-season matchup schedule</h3>
            <span>{window.weeks.length} weeks · Eastern Time</span>
          </div>
          {league.state !== "active" ? (
            <p className="fantasy-hint">
              Finish the fantasy draft to finalize the remaining-week schedule.
            </p>
          ) : window.weeks.length ? (
            window.weeks.map((week, i) => (
              <details key={week} className="fantasy-schedule-row">
                <summary>
                  SSL Week{" "}
                  {Math.round(
                    (Date.parse(week) - Date.parse(sslSeason.weekOne)) /
                      604800000,
                  ) + 1}{" "}
                  · Week of {week}
                </summary>
                {matchupPairs(
                  order.map((o) => o.user_id),
                  i,
                ).map(([a, b]) => (
                  <p key={a}>
                    {teamName(a)} vs {teamName(b)}
                  </p>
                ))}
              </details>
            ))
          ) : (
            <p className="fantasy-hint">
              The schedule appears when the SSL season calendar is published.
            </p>
          )}
        </div>
      )}
      {tab === "Standings" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>Standings</h3>
          </div>
          {league.state === "active" ? (
            <>
              <p className="fantasy-hint">
                Completed matchup weeks with official scored games. Current week
                scores are in Matchups.
              </p>
              <table className="fantasy-simple-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>W</th>
                    <th>L</th>
                    <th>T</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {[...order]
                    .sort(
                      (a, b) =>
                        records.get(b.user_id).wins -
                          records.get(a.user_id).wins ||
                        records.get(b.user_id).points -
                          records.get(a.user_id).points,
                    )
                    .map((o) => (
                      <tr key={o.user_id}>
                        <td>{teamName(o.user_id)}</td>
                        <td>{records.get(o.user_id).wins}</td>
                        <td>{records.get(o.user_id).losses}</td>
                        <td>{records.get(o.user_id).ties}</td>
                        <td>{formatScore(records.get(o.user_id).points)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="fantasy-hint">Standings open after the draft.</p>
          )}
        </div>
      )}
      {tab === "Player Stats" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>Fantasy points</h3>
            <span>Current matchup</span>
          </div>
          <div className="draft-search">
            <Search size={18} />
            <input
              placeholder="Search players"
              value={draftQuery}
              onChange={(e) => setDraftQuery(e.target.value)}
            />
          </div>
          <div className="fantasy-player-list">
            {players
              .filter((p) =>
                p.name.toLowerCase().includes(draftQuery.toLowerCase()),
              )
              .map((p) => (
                <div key={p.id}>
                  <span className="portrait-label">
                    <PlayerPortrait player={p} />
                    {p.name}
                  </span>
                  <strong>
                    {formatScore(sumScores(scoringGames, p.id, currentWeek))}
                  </strong>
                </div>
              ))}
          </div>
        </div>
      )}
      {tab === "Free Agency" && (
        <div className="fantasy-content">
          <div className="fantasy-section-head">
            <h3>Available players</h3>
          </div>
          <p className="fantasy-hint">
            Drafted players belong to their fantasy teams. Free agent claims and
            trades will open with transaction rules.
          </p>
          <div className="fantasy-player-list">
            {players
              .filter((p) => !drafted.has(p.id) && eligible.has(p.id))
              .map((p) => (
                <div key={p.id}>
                  <span className="portrait-label">
                    <PlayerPortrait player={p} />
                    {p.name}
                  </span>
                  <small>{p.class}</small>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
