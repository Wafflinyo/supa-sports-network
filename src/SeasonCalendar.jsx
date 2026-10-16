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
          : "Two weeks after the championship ends"}
      </p>
      <p>
        <strong>
          Trades: {s.tradingOpen ? "OPEN" : "CLOSED"} · Extensions:{" "}
          {s.extensionsOpen ? "OPEN" : "CLOSED"}
        </strong>
        {s.status === "offseason" ? " · OFFSEASON" : ""}
      </p>
      <p>
        Extensions open after the trade deadline. At the cutoff, unsigned
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
          : "Next-season setup unlocks when the two-week extension period ends."}
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
  const s = l.season;
  if (!s || s.status !== "postdraft" || l.access.role !== "commissioner")
    return null;
  return (
    <Box title="22-WEEK HOME & AWAY SCHEDULE">
      <p>
        Generate six games per week for 22 weeks. Each team gets 11 home games
        and 11 away games. Adjust individual times afterward.
      </p>
      <form
        className="season-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (!s.games.length || confirm("Replace the unplayed schedule?"))
            l.act("generate_schedule", {
              weekOne: f.get("weekOne"),
              time: f.get("time"),
            });
        }}
      >
        <label>
          Week 1 Sunday (Eastern Time)
          <input
            required
            type="date"
            name="weekOne"
            defaultValue={s.weekOne || ""}
          />
        </label>
        <label>
          Default Sunday game time (Eastern Time)
          <input required type="time" name="time" defaultValue="19:00" />
        </label>
        <button className="red-btn" disabled={l.busy}>
          GENERATE 22-WEEK SCHEDULE
        </button>
        <button
          type="button"
          className="outline-btn"
          disabled={l.busy}
          onClick={(e) => {
            const f = new FormData(e.currentTarget.form);
            l.act("season_calendar", { weekOne: f.get("weekOne") });
          }}
        >
          SAVE CALENDAR ONLY
        </button>
      </form>
      <p>
        Manually entered schedules must also contain all 132 home/away pairings,
        with one game per team per week.
      </p>
    </Box>
  );
}
