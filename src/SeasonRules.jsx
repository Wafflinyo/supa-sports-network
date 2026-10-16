import React, { useEffect, useState } from "react";
import pool from "./players.json";
const names = new Map(pool.map((p) => [p.id, p.name]));
export const conferences = {
  supa: "Supa Mario Conference",
  galaxy: "Mario Galaxy Conference",
};
const iso = (value) => (value ? new Date(value).toISOString() : null);
const time = (value) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: "America/New_York",
      }) + " ET"
    : "Not set";
function Box({ title, children }) {
  return (
    <section className="panel season-box">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function SeasonRuleControls({ league: l }) {
  const s = l.season,
    [selected, setSelected] = useState([]),
    [kind, setKind] = useState("allstar"),
    [label, setLabel] = useState("");
  useEffect(
    () =>
      setSelected(
        s?.teams.filter((t) => t.conference === "supa").map((t) => t.id) || [],
      ),
    [s?.id, s?.teams?.map((t) => t.conference).join(",")],
  );
  if (!s || l.access.role !== "commissioner") return null;
  return (
    <Box title="CONFERENCES, VOTING & AWARDS">
      <details>
        <summary>ASSIGN CONFERENCES · {selected.length}/6 SUPA</summary>
        <p>
          Select six Supa teams. The other six become Galaxy. Save before
          opening the draft-date poll.
        </p>
        <div className="season-team-checks">
          {s.teams.map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                checked={selected.includes(t.id)}
                onChange={() =>
                  setSelected((v) =>
                    v.includes(t.id)
                      ? v.filter((x) => x !== t.id)
                      : [...v, t.id],
                  )
                }
              />
              {t.name}
            </label>
          ))}
        </div>
        <button
          className="red-btn"
          disabled={
            l.busy ||
            selected.length !== 6 ||
            !["setup", "poll", "scheduled", "postdraft"].includes(s.status)
          }
          onClick={() => l.act("conferences", { supa: selected })}
        >
          SAVE 6 + 6 CONFERENCES
        </button>
      </details>
      <details>
        <summary>OPEN ALL-STAR / AWARD VOTING</summary>
        <form
          className="season-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            l.act("open_ballot", {
              kind:
                kind === "allstar"
                  ? "allstar"
                  : "award_" +
                    label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")
                      .slice(0, 40),
              label: kind === "allstar" ? "All-Star Voting" : label,
              closesAt: iso(f.get("closesAt")),
            });
          }}
        >
          <label>
            Ballot
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="allstar">
                All-Star · 9 players per conference
              </option>
              <option value="award">
                Season award · one player per account
              </option>
            </select>
          </label>
          {kind === "award" && (
            <label>
              Award name
              <input
                required
                value={label}
                maxLength={40}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Season MVP"
              />
            </label>
          )}
          <label>
            Voting closes (your device timezone)
            <input required type="datetime-local" name="closesAt" />
          </label>
          <button className="red-btn" disabled={l.busy}>
            OPEN BALLOT
          </button>
        </form>
      </details>
      {Object.entries(s.ballotWindows || {}).map(([key, w]) => (
        <p key={key}>
          {w.label} · {w.ballots || 0} ballots ·{" "}
          {w.open ? "Open until " + time(w.closesAt) : "Closed"}{" "}
          {w.open && (
            <button
              className="outline-btn"
              disabled={l.busy}
              onClick={() => l.act("close_ballot", { kind: key })}
            >
              CLOSE VOTING
            </button>
          )}
        </p>
      ))}
      <details>
        <summary>AWARDS CEREMONY & ANNOUNCEMENTS</summary>
        <p>
          Publish the award winners and conference champions after voting closes
          and before opening the playoffs.
        </p>
        <form
          className="season-form"
          onSubmit={(e) => {
            e.preventDefault();
            l.act("ceremony", {
              announcement: new FormData(e.currentTarget).get("announcement"),
            });
          }}
        >
          <label>
            Public announcement
            <textarea
              name="announcement"
              required
              minLength={5}
              maxLength={6000}
              defaultValue={s.awardsAnnouncement || ""}
            />
          </label>
          <button className="red-btn" disabled={l.busy}>
            PUBLISH CEREMONY & COMPLETE AWARDS
          </button>
        </form>
      </details>
    </Box>
  );
}
function Ballot({ league: l, kind, w }) {
  const [chosen, setChosen] = useState(w.myChoices || []),
    s = l.season,
    open = w.open && l.now < new Date(w.closesAt).getTime(),
    signed = !!l.access.signedIn;
  useEffect(() => setChosen(w.myChoices || []), [JSON.stringify(w.myChoices)]);
  const toggle = (id) =>
    setChosen((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  return (
    <Box title={w.label}>
      <p>
        {open ? "OPEN" : "CLOSED"} · Deadline {time(w.closesAt)} ·{" "}
        {w.ballots || 0} account ballots
      </p>
      <p>
        {kind === "allstar"
          ? "Choose nine different players from each conference. Your saved ballot can be edited until voting closes."
          : "Choose one player. Your saved vote can be edited until voting closes."}
      </p>
      {(kind === "allstar" ? ["supa", "galaxy"] : ["all"]).map((c) => (
        <details open={c === "all"} key={c}>
          <summary>
            {c === "all" ? "CANDIDATES" : conferences[c]}{" "}
            {kind === "allstar" &&
              `${chosen.filter((id) => w.candidates.some((p) => p.player === id && p.conference === c)).length}/9`}
          </summary>
          <div className="season-player-list">
            {w.candidates
              .filter((p) => c === "all" || p.conference === c)
              .map((p) => (
                <label key={p.player}>
                  <input
                    type="checkbox"
                    disabled={
                      !open ||
                      !signed ||
                      (!chosen.includes(p.player) &&
                        (kind !== "allstar"
                          ? chosen.length >= 1
                          : chosen.filter((id) =>
                              w.candidates.some(
                                (x) => x.player === id && x.conference === c,
                              ),
                            ).length >= 9))
                    }
                    checked={chosen.includes(p.player)}
                    onChange={() => toggle(p.player)}
                  />
                  {names.get(p.player)} ·{" "}
                  {s.teams.find((t) => t.id === p.team)?.name}{" "}
                  <small>{w.totals?.[p.player] || 0} votes</small>
                </label>
              ))}
          </div>
        </details>
      ))}
      {open &&
        (signed ? (
          <button
            className="red-btn"
            disabled={l.busy || chosen.length !== (kind === "allstar" ? 18 : 1)}
            onClick={() => l.act("ballot", { kind, choices: chosen })}
          >
            SAVE {kind === "allstar" ? "18-VOTE BALLOT" : "VOTE"}
          </button>
        ) : (
          <p>Sign in with any account to vote.</p>
        ))}
    </Box>
  );
}
export function PublicBallots({ league: l }) {
  const s = l.season;
  return (
    <>
      {s?.awardsAnnouncement && (
        <Box title="SEASON AWARDS & ANNOUNCEMENTS">
          <p style={{ whiteSpace: "pre-wrap" }}>{s.awardsAnnouncement}</p>
        </Box>
      )}
      {Object.entries(s?.ballotWindows || {}).map(([kind, w]) => (
        <Ballot key={s.id + kind} league={l} kind={kind} w={w} />
      ))}
    </>
  );
}
export function BroadcastControls({ league: l, game: g }) {
  const [end, setEnd] = useState("");
  return (
    <details>
      <summary>PREMIERE / POSTPONEMENT / RESULT RELEASE</summary>
      <p>
        Uploading results locks lineups immediately. Results stay private until
        the end time below, or until you confirm the premiere ended. Update this
        if YouTube delays the premiere.
      </p>
      <form
        className="season-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          l.act("broadcast", {
            game: g.id,
            youtubeUrl: f.get("youtubeUrl"),
            releaseAt: iso(end),
            startsAt: iso(f.get("startsAt")),
            announcement: f.get("announcement"),
            postponed: f.get("postponed") === "on",
          });
        }}
      >
        <label>
          YouTube premiere URL
          <input
            name="youtubeUrl"
            type="url"
            defaultValue={g.youtubeUrl || ""}
          />
        </label>
        <label>
          Change premiere start (optional, device timezone)
          <input name="startsAt" type="datetime-local" />
        </label>
        <label>
          Automatic result release: exact video end (optional, device timezone)
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <p>
          Saved release:{" "}
          {g.releaseAt ? time(g.releaseAt) : "Manual confirmation only"}. Leave
          the field blank to use manual release.
        </p>
        <label>
          <input
            name="postponed"
            type="checkbox"
            defaultChecked={g.postponed || false}
          />
          Postponed
        </label>
        <label>
          Home page & schedule announcement
          <textarea
            name="announcement"
            maxLength={1000}
            defaultValue={g.announcement || ""}
          />
        </label>
        <button className="outline-btn" disabled={l.busy}>
          SAVE BROADCAST
        </button>
      </form>
      {g.stage === "recorded" && (
        <button
          className="red-btn"
          disabled={l.busy}
          onClick={() => {
            if (
              confirm(
                "Confirm the YouTube premiere has finished? This makes results and stats public.",
              )
            )
              l.act("release_result", { game: g.id });
          }}
        >
          PREMIERE ENDED · RELEASE RESULTS
        </button>
      )}
    </details>
  );
}
export function PlayoffPanel({ league: l }) {
  const s = l.season;
  if (!s) return null;
  return (
    <Box title="SSL PLAYOFF SERIES">
      <p>
        Top eight overall. Reseed each round: highest remaining seed plays
        lowest. Quarterfinals and semifinals: best of 3. Finals: best of 5. Home
        field alternates each game, starting with the higher seed.
      </p>
      {["quarterfinal", "semifinal", "final"].map((round) => (
        <div key={round}>
          <h3>
            {
              {
                quarterfinal: "QUARTERFINALS",
                semifinal: "SEMIFINALS",
                final: "FINALS",
              }[round]
            }
          </h3>
          {(s.playoffSeries || [])
            .filter((x) => x.round === round)
            .map((x) => (
              <div className="season-game" key={x.id}>
                <strong>
                  #{x.highSeed} {s.teams.find((t) => t.id === x.high)?.name} vs
                  #{x.lowSeed} {s.teams.find((t) => t.id === x.low)?.name}
                </strong>
                <p>
                  {x.highWins} – {x.lowWins} · Best of {x.bestOf}
                  {x.winner
                    ? " · Winner: " +
                      s.teams.find((t) => t.id === x.winner)?.name
                    : ""}
                </p>
              </div>
            ))}
        </div>
      ))}
      {l.access.role === "commissioner" && s.status === "postseason" && (
        <button
          className="red-btn"
          disabled={l.busy}
          onClick={() => l.act("advance_playoffs")}
        >
          {s.playoffSeries?.length
            ? "CREATE NEXT ROUND · RESEED"
            : "CREATE QUARTERFINALS"}
        </button>
      )}
    </Box>
  );
}
