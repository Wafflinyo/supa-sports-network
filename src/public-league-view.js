// Strip unreleased report payloads from any cached commissioner season before
// rendering as a signed-out visitor. Published results and public preseason
// history are intentionally left untouched.
export function publicLeagueSeasons(seasons = []) {
  return (seasons || []).map(season => ({
    ...season,
    games: (season.games || []).map(game => {
      if (game.stage !== 'recorded') return game;
      const {result, story, ...publicGame} = game;
      return publicGame;
    }),
  }));
}
