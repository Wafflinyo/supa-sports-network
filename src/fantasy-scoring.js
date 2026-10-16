import rules from "./fantasy-rules.json" with { type: "json" };

export { rules };

export function weekKey(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: rules.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
  const localDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  localDay.setUTCDate(localDay.getUTCDate() - localDay.getUTCDay());
  return localDay.toISOString().slice(0, 10);
}

export function previousWeek(key, weeks = 1) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7 * weeks);
  return d.toISOString().slice(0, 10);
}

export function sumScores(gameScores, playerId, week) {
  return gameScores
    .filter((game) => weekKey(new Date(game.startsAt)) === week)
    .reduce(
      (total, game) => total + (game.playerScores?.[playerId]?.total || 0),
      0,
    );
}

export function matchupPairs(userIds, round = 0) {
  const positions = [...userIds];
  if (positions.length < 2 || positions.length % 2) return [];
  for (let i = 0; i < round % (positions.length - 1); i++) {
    positions.splice(1, 0, positions.pop());
  }
  return Array.from({ length: positions.length / 2 }, (_, i) => [
    positions[i],
    positions[positions.length - 1 - i],
  ]);
}

export function matchupScore(lineup, gameScores, week) {
  return (
    Math.round(
      lineup
        .filter((row) => row.slot === "starter")
        .reduce(
          (points, row) => points + sumScores(gameScores, row.player_id, week),
          0,
        ) * 100,
    ) / 100
  );
}

export function fantasySeasonReady(season, now = new Date()) {
  return (
    !!season &&
    ["postdraft", "regular"].includes(season.status) &&
    season.teams?.length === 12 &&
    season.teams.every((t) => (season.rosters?.[t.id]?.length || 0) >= 11) &&
    (season.finalStandings?.length || 0) !== 12 &&
    (!season.weekOne || weekKey(now) < previousWeek(season.weekOne, -22))
  );
}
export function fantasySeasonWindow(league, season, now = new Date()) {
  if (!season?.weekOne)
    return {
      weeks: [],
      firstWeek: weekKey(now),
      lastWeek: weekKey(now),
      viewWeek: weekKey(now),
      finished: false,
    };
  const firstWeek =
    league.first_week ||
    [season.weekOne, weekKey(new Date(league.activated_at || now))]
      .sort()
      .at(-1);
  const lastWeek = previousWeek(season.weekOne, -21);
  const weeks = Array.from({ length: 22 }, (_, i) =>
    previousWeek(season.weekOne, -i),
  ).filter((w) => w >= firstWeek);
  const actual = weekKey(now),
    viewWeek =
      actual < firstWeek ? firstWeek : actual > lastWeek ? lastWeek : actual;
  return {
    firstWeek,
    lastWeek,
    weeks,
    viewWeek,
    finished:
      actual > lastWeek ||
      !["postdraft", "regular"].includes(season.status) ||
      season.finalStandings?.length === 12,
  };
}
export function eligibleFantasyGames(league, season, games, now = new Date()) {
  if (!league.activated_at || !season?.weekOne) return [];
  const { firstWeek, lastWeek } = fantasySeasonWindow(league, season, now);
  return games.filter(
    (g) =>
      g.seasonId === league.ssl_season_id &&
      g.phase === "regular" &&
      new Date(g.startsAt) >= new Date(league.activated_at) &&
      weekKey(new Date(g.startsAt)) >= firstWeek &&
      weekKey(new Date(g.startsAt)) <= lastWeek,
  );
}
