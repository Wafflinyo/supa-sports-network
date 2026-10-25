import React, { useState } from "react";
const time = (v) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
      }).format(new Date(v)) + " ET"
    : "Not set";
function Box({ title, children }) {
  return (
    <section className="panel season-box">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function SeasonCalendar({ league: l }) {
  const s = l.season;
  if (!s) return null;
  return (
    <Box title="SEASON CALENDAR">
      <p>
        <strong>22 weeks · 22 games per team · 132 regular-season games</strong>
        <br />
        Each opponent once home and once away. All-Star break: between Weeks 11
        and 12.
      </p>
      <p>
        Week 1 Sunday: {s.weekOne || "Set with the schedule"}
        <br />
        Trades close:{" "}
        {s.tradeDeadlineAt
          ? time(new Date(new Date(s.tradeDeadlineAt).getTime() - 1000))
          : "End of Week 12 (Eastern Time)"}
        <br />
        Extensions close:{" "}
        {s.extensionClosesAt
          ? time(s.extensionClosesAt)
          : "One calendar month after the championship ends"}
      </p>
      <p>
        <strong>
          Trades: {s.tradingOpen ? "OPEN" : "CLOSED"} · Extensions:{" "}
          {s.extensionsOpen ? "OPEN" : "CLOSED"}
        </strong>
        {s.status === "offseason" ? " · OFFSEASON" : ""}
      </p>
      <p>
        Extensions open after the championship. All teams using or voiding their contracts closes the window early; otherwise it closes after one calendar month. At the cutoff, unsigned
        players leave and unused contracts expire. Each season gets three fresh
        contracts. Offseason trades reopen then, continuing through next-season
        preparation until the draft begins.
      </p>
    </Box>
  );
}
export function NextSeason({ league: l }) {
  const [value, setValue] = useState(""),
    latest = l.seasons[0],
    ready = !latest || ["offseason", "archived"].includes(latest.status);
  if (l.access.role !== "commissioner") return null;
  return (
    <Box title={latest ? "SET UP NEXT SEASON" : "SET UP FIRST SEASON"}>
      <p>
        {ready
          ? "This archives the completed season in SSL History and begins the next season’s preparation. Games do not start yet."
          : "Next-season setup unlocks when the extension period ends."}
      </p>
      <form
        className="season-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await l.act("create", {
              name: value || "S" + ((latest?.number || 0) + 1),
            })
          )
            setValue("");
        }}
      >
        <label>
          Season name
          <input
            value={value}
            maxLength={60}
            placeholder={"S" + ((latest?.number || 0) + 1)}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="red-btn" disabled={l.busy || !ready}>
          {latest ? "SET UP NEXT SEASON" : "SET UP SEASON"}
        </button>
      </form>
    </Box>
  );
}
export function ScheduleGenerator({ league: l }) {
  const s=l.season;
  if(!s||s.status!=='postdraft'||l.access.role!=='commissioner')return null;
  const regular=(s.games||[]).filter(g=>g.phase==='regular');
  const dated=regular.filter(g=>g.startsAt).length;
  return <Box title="GENERATE SEASON 1 MATCHUPS · DATES LATER">
    <p>Generate all <strong>132 matchups across 22 weeks</strong>, six games per week. Each team faces every opponent twice — once at home and once away — for exactly 11 home and 11 away games per franchise.</p>
    <p><strong>Matchups first, dates second.</strong> Generate the weekly pairing list now, then enter each game's actual date and time in Schedule &amp; Results. You can publish the matchups immediately with Date TBD and add real dates afterward.</p>
    <button type="button" className="red-btn" disabled={l.busy} onClick={()=>{
      if(!regular.length||confirm('Replace the unplayed matchups? Any dates entered on the old matchup list will be lost.'))l.act('generate_schedule',{});
    }}>{regular.length?'REGENERATE 22-WEEK MATCHUPS':'GENERATE 22-WEEK MATCHUPS'}</button>
    {regular.length>0&&<p role="status"><strong>{dated} / 132 games dated.</strong> {dated===132?'Dates complete. Review Week 1 before publishing.':'Undated matchups remain visible publicly as Date TBD once you publish.'}</p>}
    <details className="schedule-anchor-settings"><summary>OPTIONAL · SET WEEK 1 SUNDAY / TRADE DEADLINE</summary>
      <p>The site can derive Week 1 Sunday when you date the first Week 1 game, or you can set it here. It is not required to publish the matchup list.</p>
      <form className="season-form" onSubmit={e=>{e.preventDefault();const weekOne=new FormData(e.currentTarget).get('weekOne');l.act('season_calendar',{weekOne});}}>
        <label>Week 1 Sunday (Eastern Time)<input required type="date" name="weekOne" defaultValue={s.weekOne||''}/></label>
        <button className="outline-btn" disabled={l.busy}>SAVE WEEK 1 SUNDAY</button>
      </form>
    </details>
  </Box>;
}
