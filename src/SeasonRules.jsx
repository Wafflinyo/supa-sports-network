import React, { useEffect, useState } from "react";
import {CheckCircle2, Clock3, Star, Trophy, Vote} from 'lucide-react';
import {PlayerPortrait} from './PlayerPortrait.jsx';
import {CommissionerVoteTracker} from './VoteParticipation.jsx';
import {ConferenceMark} from './ConferenceMark.jsx';
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
      <div className="conference-auto-note"><strong>CONFERENCES · AUTOMATIC</strong><p>GMs select their conference during team creation. There are six spots in Supa Mario and six in Mario Galaxy. Conference selections carry into the season automatically, so no manual assignment is needed.</p><p>Current season: {s.teams.filter(t=>t.conference==='supa').length}/6 Supa Mario · {s.teams.filter(t=>t.conference==='galaxy').length}/6 Mario Galaxy</p></div>
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
    isAllStar = kind === "allstar",
    required = isAllStar ? 18 : 1,
    open = w.open && l.now < new Date(w.closesAt).getTime(),
    signed = !!l.access.signedIn,
    candidates = w.candidates || [];
  useEffect(() => setChosen(w.myChoices || []), [JSON.stringify(w.myChoices)]);
  const countFor = (conference) => chosen.filter(id=>candidates.some(p=>p.player===id && p.conference===conference)).length;
  const toggle = id => setChosen(v=>isAllStar ? (v.includes(id)?v.filter(x=>x!==id):[...v,id]) : (v.includes(id)?[]:[id]));
  return (
    <section className="panel ssl-ballot-panel" id={'ssl-voting-'+kind} style={{scrollMarginTop:125}} aria-label={w.label}>
      <div className="ssl-ballot-banner">
        <div className="ssl-ballot-symbol">{isAllStar ? <Star size={34}/> : <Trophy size={34}/>}</div>
        <div className="ssl-ballot-title">
          <span className="ssl-ballot-overline">SLUGGERS SUPA LEAGUE · OFFICIAL BALLOT</span>
          <h2>{w.label}</h2>
          <p>{isAllStar ? 'The best of both conferences. Select your nine All-Stars from each side.' : 'One vote. One winner. Make your choice count.'}</p>
        </div>
        <span className={`ssl-poll-state ${open?'is-open':'is-closed'}`}><Clock3 size={15}/>{open?'VOTING OPEN':'BALLOT CLOSED'}</span>
      </div>
      <div className="ssl-ballot-body">
        <div className="ssl-ballot-meta"><span><Clock3 size={17}/> Closes {time(w.closesAt)}</span><span><Vote size={17}/> {w.ballots || 0} ballots submitted</span>
          {w.myChoices?.length>0&&<span className="ssl-ballot-saved"><CheckCircle2 size={17}/> Saved ballot on file</span>}</div>
        {l.access.role === "commissioner" && <CommissionerVoteTracker
          type="ballot"
          teams={s?.teams || []}
          voters={l.ballotVoters ? (l.ballotVoters[kind] || []) : null}
          error={l.ballotVotersError}
          votedIds={(l.ballotVoters?.[kind] || []).map(v => v.teamId).filter(Boolean)}
        />}
        <div className="ssl-ballot-progress"><div><strong>{chosen.length} / {required}</strong><span>players selected</span></div>
          <div className="ssl-ballot-track" aria-label={`${chosen.length} of ${required} choices selected`}><span style={{width:`${Math.min(100,100*chosen.length/required)}%`}}/></div></div>
        {(isAllStar ? ['supa','galaxy'] : ['all']).map((c) => {
          const conferencePlayers = candidates.filter(p => c === 'all' || p.conference===c);
          const conferenceCount = c==='all' ? chosen.length : countFor(c);
          return <details className="ssl-ballot-conference" key={c} open={c==='all' || c==='supa'}>
            <summary>
              <span className="ssl-ballot-conference-name">{c==='all'?<Trophy size={23}/>:<ConferenceMark id={c} size={38}/>}<strong>{c==='all'?'OFFICIAL CANDIDATES':conferences[c]}</strong></span>
              <span className="ssl-ballot-count">{conferenceCount} / {isAllStar?9:1} PICKED</span>
            </summary>
            <div className="ssl-ballot-candidates">
              {conferencePlayers.map(p => {
                const selected=chosen.includes(p.player);
                const maxed=isAllStar ? countFor(c)>=9 : chosen.length>=1;
                const disabled=!open||!signed||(!selected&&isAllStar&&maxed);
                const player=pool.find(x=>x.id===Number(p.player));
                return <label key={p.player} className={`ssl-ballot-candidate ${selected?'is-selected':''} ${disabled?'is-disabled':''}`}>
                  <input type="checkbox" disabled={disabled} checked={selected} onChange={()=>toggle(p.player)}/>
                  <span className="ssl-ballot-player"><PlayerPortrait player={player} size={43}/><span><strong>{names.get(p.player) || player?.name || 'Player'}</strong><small>{s.teams.find(t=>t.id===p.team)?.name || 'SSL Team'}</small></span></span>
                  <span className="ssl-ballot-candidate-foot"><span>{w.totals?.[p.player]||0} votes</span>{selected&&<CheckCircle2 size={20}/>}</span>
                </label>;
              })}
            </div>
          </details>;
        })}
        <div className="ssl-ballot-action">
          <div><strong>{chosen.length === required?'YOUR PICKS ARE READY':'BUILD YOUR BALLOT'}</strong><p>{open ? 'You can change and resubmit your vote until the deadline.' : 'This ballot is closed to new votes.'}</p></div>
          {open && (signed ?
            <button className="red-btn" disabled={l.busy||chosen.length!==required} onClick={()=>l.act('ballot',{kind,choices:chosen})}>{w.myChoices?.length?'UPDATE':'SUBMIT'} {isAllStar?'ALL-STAR BALLOT':'VOTE'}</button>
            : <p className="ssl-ballot-signin">Sign in to cast your vote.</p>)}
        </div>
      </div>
    </section>
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
      {["scheduled","live","recorded"].includes(g.stage) && <button type="button" className="outline-btn" disabled={l.busy} onClick={()=>{if(confirm("Cancel this unreleased game?")) l.act("cancel_game",{game:g.id});}}>CANCEL GAME</button>}
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
