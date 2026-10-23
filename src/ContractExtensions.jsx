import React, { useState, useEffect, useRef } from "react";
import pool from "./players.json";
import { PlayerPortrait } from "./PlayerPortrait.jsx";
import { SeasonCalendar } from "./SeasonCalendar.jsx";
import {taggedName} from "./PlayerPriority.jsx";
const name = (id) => taggedName(pool.find((p) => p.id === Number(id)));
const ordinal = (n) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
export default function ContractExtensions({ league: l }) {
  const s = l.season,
    [acting, setActing] = useState(""),
    [contract, setContract] = useState(""),
    [player, setPlayer] = useState(""),
    [assetType, setAssetType] = useState("player"),
    [stadium, setStadium] = useState(""),
    [quote, setQuote] = useState(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(false),
    applying = useRef(false);
  const team = l.access.role === "commissioner" ? acting : l.myTeam?.id,
    balance = s?.contractBalances?.find((x) => x.team === team)?.tokens || 0,
    open =
      s?.extensionsOpen &&
      s.status === "retention",
    allowed = ["gm", "commissioner"].includes(l.access.role);
  const ownedStadiums = [...new Set([...(s?.retainedStadiums?.[team] || []), ...(s?.picks || []).filter(p => p.team === team && p.kind === "stage").map(p => p.stage)])];
  const stadiumOffers = s?.stadiumExtensionOffers || [];
  const chosen = assetType === "stadium" ? stadium : player;
  const chosenName = assetType === "stadium" ? stadium : name(player);
  useEffect(() => {
    setContract("");
    setPlayer("");
    setStadium("");
    setAssetType("player");
    setQuote(null);
    setResult(null);
  }, [team, s?.id]);
  useEffect(() => {
    if (contract && Number(contract) > balance) setContract("");
  }, [balance, contract]);
  useEffect(() => {
    let active = true;
    setQuote(null);
    setError("");
    if (!chosen || !team || !s || !allowed) return;
    setLoading(true);
    const rpc = assetType === "stadium" ? "ssl_stadium_extension_preview" : "ssl_extension_preview";
    const args = assetType === "stadium"
      ? { season: s.id, team, stadium }
      : { season: s.id, team, player: Number(player) };
    l.supabase.rpc(rpc, args).then(r => {
      if (!active) return;
      if (r.error) setError(r.error.message);
      else setQuote(r.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [s?.id, team, player, stadium, assetType, s?.status, s?.games?.length,
      s?.champion, s?.finalist, s?.extensionOffers?.length,
      s?.stadiumExtensionOffers?.length, balance, allowed]);
  async function apply() {
    if (applying.current || !quote || !chosen) return;
    applying.current = true;
    setPending(true);
    setResult(null);
    setError("");
    const type = assetType;
    const label = chosenName;
    try {
      const [r] = await Promise.all([
        l.act(type === "stadium" ? "extension_stadium" : "extension", {
          team,
          ...(type === "stadium" ? { stadium } : { player: Number(player) }),
          quoteFingerprint: quote.fingerprint,
        }),
        new Promise(resolve => setTimeout(resolve, 1600)),
      ]);
      if (r && typeof r.accepted === "boolean") {
        setResult({ type, name: label, accepted: r.accepted, chance: r.quote.total });
        setContract("");
        setPlayer("");
        setStadium("");
      } else {
        setError("The contract was not applied. Review the error and refresh the acceptance chance.");
      }
    } finally {
      applying.current = false;
      setPending(false);
    }
  }
  if (!s)
    return (
      <section className="panel season-box">
        <h2>CONTRACT EXTENSIONS</h2>
        <p>No season yet.</p>
      </section>
    );
  return (
    <>
      <SeasonCalendar league={l} />
      <section className="panel season-box contract-extensions">
        <h2>ONE-SEASON EXTENSION CONTRACTS</h2>
        <p>
          Each team receives three extension contracts shared between players and Stadiums when the season’s extension window
          opens. The maximum is three total. If a Stadium accepts an extension, that Stadium stays with the franchise next season and the franchise loses its next Stadium Pick. Without a retained Stadium, the franchise receives its normal Stadium Pick. Unused contracts expire at the cutoff; contracts cannot be traded.
        </p>
        <details>
          <summary>ACCEPTANCE RULES</summary>
          <p>
            Base odds by next extension number: 1st 100%, 2nd 85%, 3rd 70%, 4th
            50%, 5th 25%, 6th and later 15%. Only accepted contracts advance
            this franchise’s history with the player or Stadium.
          </p>
          <p>
            Top eight qualify for playoffs. Highest finish bonus only: playoffs
            +5%, semifinals +10%, finals +15%, champion +20%. Final
            regular-season places 9–10: −10%; 11th: −15%; 12th: −20%. Total
            chance is base plus the earned modifier, capped between 0% and 100%.
            Before the regular season finishes, no final-standings penalty is
            applied.
          </p>
        </details>
        {l.access.role === "commissioner" && (
          <label>
            Team
            <select
              aria-label="Extension team"
              disabled={pending}
              value={acting}
              onChange={(e) => setActing(e.target.value)}
            >
              <option value="">Choose team</option>
              {s.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {allowed && team && (
          <>
            <h3>{balance} / 3 CONTRACTS AVAILABLE</h3>
            {open ? (
              <>
                <label>
                  Select contract
                  <select
                    aria-label="Select extension contract"
                    disabled={pending}
                    value={contract}
                    onChange={(e) => {
                      setContract(e.target.value);
                      setPlayer("");
                      setStadium("");
                      setQuote(null);
                      setResult(null);
                    }}
                  >
                    <option value="">Choose a contract</option>
                    {Array.from({ length: balance }, (_, i) => (
                      <option key={i} value={i + 1}>
                        One-season extension contract {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                {contract && (
                  <>
                    <label>Extension target
                      <select aria-label="Extension target type" disabled={pending}
                        value={assetType}
                        onChange={ev => { setAssetType(ev.target.value); setPlayer(""); setStadium(""); setQuote(null); setResult(null); }}>
                        <option value="player">Player</option>
                        <option value="stadium">Stadium</option>
                      </select>
                    </label>
                    {assetType === "player" ? (
                      <label>Select player
                        <select aria-label="Select extension player" disabled={pending} value={player}
                          onChange={ev => { setPlayer(ev.target.value); setResult(null); }}>
                          <option value="">Choose a player</option>
                          {(s.rosters[team] || [])
                            .filter(id => !s.extensionOffers?.some(o => o.franchise === team && o.player === id && o.accepted))
                            .map(id => <option key={id} value={id}>{name(id)}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label>Select Stadium
                        <select aria-label="Select extension Stadium" disabled={pending} value={stadium}
                          onChange={ev => { setStadium(ev.target.value); setResult(null); }}>
                          <option value="">Choose a Stadium</option>
                          {ownedStadiums
                            .filter(x => !stadiumOffers.some(o => o.franchise === team && o.stadium === x && o.accepted))
                            .map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                        {!ownedStadiums.length && <small>This team has no Stadium yet.</small>}
                      </label>
                    )}
                  </>
                )}
                {loading && chosen && !pending && (
                  <p role="status">Calculating acceptance chance…</p>
                )}
                {quote && !pending && (
                  <div className="contract-chance" aria-live="polite">
                    <h3>{chosenName}</h3>
                    <dl>
                      <div>
                        <dt>{ordinal(quote.ordinal)} repeat / extension</dt>
                        <dd>{quote.base}%</dd>
                      </div>
                      <div>
                        <dt>{quote.modifierLabel}</dt>
                        <dd>
                          {quote.modifier > 0 ? "+" : ""}
                          {quote.modifier}%
                        </dd>
                      </div>
                      <div className="contract-total">
                        <dt>Total chance</dt>
                        <dd>{quote.total}%</dd>
                      </div>
                    </dl>
                    <p>
                      Applying consumes one contract immediately, even if the
                      player or Stadium is not retained. Previewing consumes nothing.
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="season-error">
                    {error}
                  </p>
                )}
                <button
                  className="red-btn"
                  disabled={
                    pending ||
                    l.busy ||
                    !contract ||
                    !chosen ||
                    !quote ||
                    balance < 1
                  }
                  onClick={apply}
                >
                  {pending ? "CONTRACT DECISION IN PROGRESS…" : "APPLY CONTRACT"}
                </button>
              </>
            ) : (
              <p>
                Extensions open after the championship and close one calendar month later, or earlier once all teams finish their decisions.
              </p>
            )}
          </>
        )}
        {allowed && open && team && balance>0 && <button className="outline-btn" disabled={pending||l.busy} onClick={()=>{if(confirm("Void all remaining extension contracts for this team? These contracts will be forfeited.")) l.act("void_extensions",{team});}}>VOID REMAINING EXTENSIONS ({balance})</button>}
        {pending && (
          <div className="contract-decision waiting" role="status">
            <span className="contract-spinner" aria-hidden="true" />
            The extension offer is being decided…
          </div>
        )}
        {result && !pending && (
          <div
            className={`contract-decision ${result.accepted ? "accepted" : "declined"}`}
            role="status"
          >
            <h3>
              {result.accepted ? "CONTRACT ACCEPTED" : "EXTENSION DECLINED"}
            </h3>
            <p>
              {result.name}{" "}
              {result.accepted
                ? "has accepted the one-season extension!"
                : result.type === "stadium" ? "will not be retained for next season." : "has decided to test out free agency."}
            </p>
            <p>
              One contract consumed · Acceptance chance was {result.chance}%.
            </p>
          </div>
        )}
        <div className="season-table">
          <table>
            <thead>
              <tr>
                <th>Player / Stadium</th>
                <th>Franchise</th>
                <th>Chance</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {!pending && [
                ...(s.extensionOffers || []).map(o => ({...o, type: "player"})),
                ...stadiumOffers.map(o => ({...o, type: "stadium"})),
              ].map(o => (
                <tr key={o.type + "-" + (o.attempt || o.franchise + (o.player || o.stadium))}>
                  <td><span className="portrait-label">
                    {o.type === "stadium" ? <><strong>STADIUM · </strong>{o.stadium}</> : <>
                      <PlayerPortrait player={pool.find(p => p.id === o.player)}/>{name(o.player)}
                    </>}
                  </span></td>
                  <td>{s.teams.find(t => t.id === o.franchise)?.name}</td>
                  <td>{o.chance}%</td>
                  <td>{o.accepted ? "Accepted" : o.type === "stadium" ? "Not retained" : "Testing free agency"} · contract consumed</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
