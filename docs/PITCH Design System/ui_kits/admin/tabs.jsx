/* global React, Crest, Icon, team */
const { useState: useStateT } = React;

const FIXTURES_DAY = [
  { id: 1, time: "14:00", group: "Group A · MD9", home: "THU", away: "BLZ", hs: 2, as: 1, status: "live", min: "67'", field: "North Field" },
  { id: 2, time: "16:30", group: "Group A · MD9", home: "GRV", away: "NRT", status: "up", field: "North Field" },
  { id: 3, time: "18:00", group: "Group B · MD8", home: "KNG", away: "OAK", status: "up", field: "South Field" },
  { id: 4, time: "11:00", group: "Group B · MD8", home: "RIV", away: "HRB", hs: 0, as: 3, status: "ft", field: "South Field" },
];

const MatchCard = ({ m, onClick }) => {
  const homeWin = m.status === "ft" && m.hs > m.as;
  const awayWin = m.status === "ft" && m.as > m.hs;
  return (
    <div className={`match ${m.status}`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="top">
        <span className="grp">{m.group} · {m.field}</span>
        <span className="stat">
          {m.status === "live" && <><span className="livedot"/>Live · {m.min}</>}
          {m.status === "up" && <>Upcoming · {m.time}</>}
          {m.status === "ft" && <>Full time</>}
        </span>
      </div>
      <div className="tline">
        <div className="team"><Crest code={m.home}/><span className={`nm ${awayWin ? "dim" : ""}`}>{team(m.home).name}</span></div>
        <span className={`score ${m.status === "up" ? "dim" : ""} ${awayWin ? "dim" : ""}`}>{m.hs ?? "—"}</span>
      </div>
      <div className="tline">
        <div className="team"><Crest code={m.away}/><span className={`nm ${homeWin ? "dim" : ""}`}>{team(m.away).name}</span></div>
        <span className={`score ${m.status === "up" ? "dim" : ""} ${homeWin ? "dim" : ""}`}>{m.as ?? "—"}</span>
      </div>
    </div>
  );
};

const OverviewTab = ({ onOpenLive }) => (
  <>
    <div className="lockbar"><strong>Tournament is Active.</strong>&nbsp;Format, points and team list are locked.</div>
    <div>
      <div className="shead"><h2>Today · Matchday 9</h2><span className="more">View all</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {FIXTURES_DAY.slice(0, 3).map(m => <MatchCard key={m.id} m={m} onClick={m.status === "live" ? onOpenLive : undefined}/>)}
      </div>
    </div>
    <div>
      <div className="shead"><h2>Group A · standings</h2><span className="more">Full table</span></div>
      <div className="card" style={{ marginTop: 10 }}>
        <table className="standings">
          <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            <tr className="q"><td><span className="rank">1</span></td><td><div className="tnm"><Crest code="THU" size={20}/>Thunderhawks</div></td><td>4</td><td>+6</td><td><span className="pts">10</span></td></tr>
            <tr className="q"><td><span className="rank">2</span></td><td><div className="tnm"><Crest code="GRV" size={20}/>Grovers</div></td><td>4</td><td>+3</td><td><span className="pts">7</span></td></tr>
            <tr><td><span className="rank">3</span></td><td><div className="tnm"><Crest code="BLZ" size={20}/>Blazers FC</div></td><td>4</td><td>0</td><td><span className="pts">6</span></td></tr>
            <tr><td><span className="rank">4</span></td><td><div className="tnm"><Crest code="NRT" size={20}/>Northstars</div></td><td>4</td><td>−9</td><td><span className="pts">0</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div>
      <div className="shead"><h2>Top scorers</h2></div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="rrow"><span className="num" style={{ color: "var(--brand-lime)" }}>1</span><div><div className="pn">M. Owens</div><div className="pos">THU · ST</div></div><span className="stat"><img src="assets/icon-ball.svg" width="14" height="14" alt=""/>7</span></div>
        <div className="rrow"><span className="num">2</span><div><div className="pn">A. Reyes</div><div className="pos">GRV · LW</div></div><span className="stat"><img src="assets/icon-ball.svg" width="14" height="14" alt=""/>5</span></div>
        <div className="rrow"><span className="num">3</span><div><div className="pn">D. Hales</div><div className="pos">BLZ · CM</div></div><span className="stat"><img src="assets/icon-ball.svg" width="14" height="14" alt=""/>4</span></div>
      </div>
    </div>
  </>
);

const FixturesTab = ({ onOpenLive }) => {
  const [filter, setFilter] = useStateT("all");
  return (
    <>
      <div className="chiprow">
        {["All", "Live now", "Today", "Upcoming", "Full time"].map(c => (
          <button key={c} className="chip" aria-pressed={filter === c.toLowerCase()} onClick={() => setFilter(c.toLowerCase())}>{c}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FIXTURES_DAY.map(m => <MatchCard key={m.id} m={m} onClick={m.status === "live" ? onOpenLive : undefined}/>)}
      </div>
    </>
  );
};

const StandingsTab = () => (
  <>
    <div className="shead"><h2>Group A</h2><span className="more">Top 2 advance</span></div>
    <div className="card">
      <table className="standings">
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          <tr className="q"><td><span className="rank">1</span></td><td><div className="tnm"><Crest code="THU" size={20}/>Thunderhawks</div></td><td>4</td><td>3</td><td>1</td><td>0</td><td>+6</td><td><span className="pts">10</span></td></tr>
          <tr className="q"><td><span className="rank">2</span></td><td><div className="tnm"><Crest code="GRV" size={20}/>Grovers</div></td><td>4</td><td>2</td><td>1</td><td>1</td><td>+3</td><td><span className="pts">7</span></td></tr>
          <tr><td><span className="rank">3</span></td><td><div className="tnm"><Crest code="BLZ" size={20}/>Blazers FC</div></td><td>4</td><td>2</td><td>0</td><td>2</td><td>0</td><td><span className="pts">6</span></td></tr>
          <tr><td><span className="rank">4</span></td><td><div className="tnm"><Crest code="NRT" size={20}/>Northstars</div></td><td>4</td><td>0</td><td>0</td><td>4</td><td>−9</td><td><span className="pts">0</span></td></tr>
        </tbody>
      </table>
    </div>
    <div className="shead" style={{ marginTop: 6 }}><h2>Group B</h2><span className="more">Top 2 advance</span></div>
    <div className="card">
      <table className="standings">
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          <tr className="q"><td><span className="rank">1</span></td><td><div className="tnm"><Crest code="KNG" size={20}/>Kingfishers</div></td><td>4</td><td>3</td><td>0</td><td>1</td><td>+5</td><td><span className="pts">9</span></td></tr>
          <tr className="q"><td><span className="rank">2</span></td><td><div className="tnm"><Crest code="HRB" size={20}/>Harborside</div></td><td>4</td><td>2</td><td>1</td><td>1</td><td>+2</td><td><span className="pts">7</span></td></tr>
          <tr><td><span className="rank">3</span></td><td><div className="tnm"><Crest code="OAK" size={20}/>Oakwood</div></td><td>4</td><td>1</td><td>1</td><td>2</td><td>−1</td><td><span className="pts">4</span></td></tr>
          <tr><td><span className="rank">4</span></td><td><div className="tnm"><Crest code="RIV" size={20}/>Rivertons</div></td><td>4</td><td>0</td><td>2</td><td>2</td><td>−6</td><td><span className="pts">2</span></td></tr>
        </tbody>
      </table>
    </div>
  </>
);

const BracketTab = () => {
  const Match = ({ home, away, hs, as, time, ft }) => {
    const hw = ft && hs > as, aw = ft && as > hs;
    return (
      <div className="bmatch">
        <div className={`brow ${hw ? "winner" : ""}`}><span className="nm">{home === "TBD" ? <span className="tbd">Awaiting winner</span> : <><Crest code={home} size={18}/>{team(home).name}</>}</span><span className="sc">{hs ?? "—"}</span></div>
        <div className={`brow ${aw ? "winner" : ""}`}><span className="nm">{away === "TBD" ? <span className="tbd">Awaiting winner</span> : <><Crest code={away} size={18}/>{team(away).name}</>}</span><span className="sc">{as ?? "—"}</span></div>
        <div className="bmeta">{ft ? "Final" : time}</div>
      </div>
    );
  };
  return (
    <div className="bracket-shell">
      <div className="bracket-round">
        <div className="bracket-round-label">Quarterfinals</div>
        <Match home="THU" away="OAK" hs={3} as={1} ft/>
        <Match home="HRB" away="GRV" hs={1} as={2} ft/>
        <Match home="KNG" away="BLZ" time="Sat · 14:00"/>
        <Match home="NRT" away="RIV" time="Sat · 16:30"/>
      </div>
      <div className="bracket-round">
        <div className="bracket-round-label">Semifinals</div>
        <Match home="THU" away="GRV" time="Sun · 14:00"/>
        <Match home="TBD" away="TBD" time="Sun · 16:30"/>
      </div>
      <div className="bracket-round">
        <div className="bracket-round-label">Final</div>
        <Match home="TBD" away="TBD" time="Mon · 19:00"/>
      </div>
      <div className="trophy-cell">
        <img src="assets/icon-trophy.svg" alt=""/>
        <div className="label">Champion</div>
        <div className="winner-name">TBD</div>
      </div>
    </div>
  );
};

const TeamsTab = () => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {Object.values(window.TEAMS).map(t => (
        <div key={t.code} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <Crest code={t.code} size={36}/>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{t.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)", letterSpacing: "0.04em" }}>16 PLAYERS · CAPTAIN J. DOE</div>
        </div>
      ))}
    </div>
  </>
);

const ScorersTab = () => (
  <>
    <div className="shead"><h2>Golden boot race</h2><span className="more" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-400)" }}>Updated 67'</span></div>
    <div className="card">
      <div className="roster">
        {[
          [1, "M. Owens", "THU · ST", 7, true],
          [2, "A. Reyes", "GRV · LW", 5],
          [3, "D. Hales", "BLZ · CM", 4],
          [4, "P. Voss", "KNG · ST", 4],
          [5, "T. Iglesias", "HRB · RW", 3],
          [6, "S. Park", "THU · CM", 3],
        ].map(([n, name, pos, gls, gold]) => (
          <div className="rrow" key={n}>
            <span className="num" style={gold ? { color: "var(--brand-lime)" } : {}}>{n}</span>
            <div><div className="pn">{name}</div><div className="pos">{pos}</div></div>
            <span className="stat"><img src="assets/icon-ball.svg" width="14" height="14" alt=""/>{gls}</span>
          </div>
        ))}
      </div>
    </div>
  </>
);

const SettingsTab = () => (
  <>
    <div className="lockbar"><strong>Tournament is Active.</strong>&nbsp;Format and points are locked until Finished.</div>
    <div className="card">
      <div className="field"><label>Tournament name</label><input defaultValue="Eastside University Cup"/></div>
      <div className="field locked"><label>🔒 Format</label><input defaultValue="Round robin + knockout" readOnly/><span className="help">Locked — first match has been scheduled.</span></div>
      <div className="field locked"><label>🔒 Points</label><input defaultValue="Win 3 · Draw 1 · Loss 0" readOnly/></div>
      <div className="field"><label>Cover description</label><textarea rows="3" defaultValue="Annual intramural cup across 8 teams from Eastside dorms."/></div>
      <button className="btn full primary">Save changes</button>
      <div style={{ height: 14 }}/>
      <button className="btn full danger">Mark tournament as finished</button>
    </div>
  </>
);

window.OverviewTab = OverviewTab;
window.FixturesTab = FixturesTab;
window.StandingsTab = StandingsTab;
window.BracketTab = BracketTab;
window.TeamsTab = TeamsTab;
window.ScorersTab = ScorersTab;
window.SettingsTab = SettingsTab;
window.MatchCard = MatchCard;
