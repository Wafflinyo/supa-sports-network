import React, { useState, useEffect, useRef } from "react";
import pool from "./players.json";
import { PlayerPortrait } from "./PlayerPortrait.jsx";
import { SeasonCalendar } from "./SeasonCalendar.jsx";
const name = (id) => pool.find((p) => p.id === Number(id))?.name || "Player";
const ordinal = (n) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
export default function ContractExtensions({ league: l }) {
  const s = l.season,
    [acting, setActing] = useState(""),
    [contract, setContract] = useState(""),
    [player, setPlayer] = useState(""),
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
  useEffect(() => {
    setContract("");
    setPlayer("");
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
    if (!player || !team || !s || !allowed) return;
    setLoading(true);
    l.supabase
      .rpc("ssl_extension_preview", {
        season: s.id,
        team,
        player: Number(player),
      })
      .then((r) => {
        if (!active) return;
        if (r.error) setError(r.error.message);
        else setQuote(r.data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    s?.id,
    team,
    player,
    s?.status,
    s?.games?.length,
    s?.champion,
    s?.finalist,
    s?.extensionOffers?.length,
    balance,
    allowed,
  ]);
  async function apply() {
    if (applying.current || !quote) return;
    applying.current = true;
    setPending(true);
    setResult(null);
    setError("");
    const chosen = Number(player),
      label = name(chosen);
    try {
      const [r] = await Promise.all([
        l.act("extension", {
          team,
          player: chosen,
          quoteFingerprint: quote.fingerprint,
        }),
        new Promise((resolve) => setTimeout(resolve, 1600)),
      ]);
      if (r && typeof r.accepted === "boolean") {
        setResult({
          player: chosen,
          name: label,
          accepted: r.accepted,
          chance: r.quote.total,
        });
        setContract("");
        setPlayer("");
      } else
        setError(
          "The contract was not applied. Review the message above, then select the player again to refresh the odds.",
        );
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
          Each team receives three contracts when the season’s extension window
          opens. The maximum is three. Unused contracts expire at the cutoff;
          contracts cannot be traded.
        </p>
        <details>
          <summary>ACCEPTANCE RULES</summary>
          <p>
            Base odds by next extension number: 1st 100%, 2nd 85%, 3rd 70%, 4th
            50%, 5th 25%, 6th and later 15%. Only accepted contracts advance
            this franchise’s history with the player.
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
                  <label>
                    Select player
                    <select
                      aria-label="Select extension player"
                      disabled={pending}
                      value={player}
                      onChange={(e) => {
                        setPlayer(e.target.value);
                        setResult(null);
                      }}
                    >
                      <option value="">Choose a player</option>
                      {(s.rosters[team] || [])
                        .filter(
                          (id) =>
                            !s.extensionOffers.some(
                              (o) => o.franchise === team && o.player === id && o.accepted,
                            ),
                        )
                        .map((id) => (
                          <option key={id} value={id}>
                            {name(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {loading && player && !pending && (
                  <p role="status">Calculating acceptance chance…</p>
                )}
                {quote && !pending && (
                  <div className="contract-chance" aria-live="polite">
                    <h3>{name(player)}</h3>
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
                      player chooses free agency. Previewing consumes nothing.
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
                    !player ||
                    !quote ||
                    balance < 1
                  }
                  onClick={apply}
                >
                  {pending ? "PLAYER IS CONSIDERING…" : "APPLY CONTRACT"}
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
            The player is considering the contract…
          </div>
        )}
        {result && !pending && (
          <div
            className={`contract-decision ${result.accepted ? "accepted" : "declined"}`}
            role="status"
          >
            <h3>
              {result.accepted ? "CONTRACT ACCEPTED" : "TESTING FREE AGENCY"}
            </h3>
            <p>
              {result.name}{" "}
              {result.accepted
                ? "has accepted the one-season extension!"
                : "has decided to test out free agency."}
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
                <th>Player</th>
                <th>Franchise</th>
                <th>Chance</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {!pending &&
                s.extensionOffers?.map((o) => (
                  <tr key={o.attempt || o.franchise + o.player}>
                    <td>
                      <span className="portrait-label">
                        <PlayerPortrait
                          player={pool.find((p) => p.id === o.player)}
                        />
                        {name(o.player)}
                      </span>
                    </td>
                    <td>{s.teams.find((t) => t.id === o.franchise)?.name}</td>
                    <td>{o.chance}%</td>
                    <td>
                      {o.accepted ? "Accepted" : "Testing free agency"} ·
                      contract consumed
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
