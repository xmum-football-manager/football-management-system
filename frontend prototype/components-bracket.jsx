/* global React, TOURNAMENT, team, Reveal */
const { useState: useStateB, useEffect: useEffectB } = React;

// ============ BRACKET ============
const BracketTeamRow = ({ code, score, isWinner }) => {
  if (code === "TBD" || code?.startsWith("TBD-")) {
    return (
      <div className="bracket-team-row tbd">
        <span className="crest" style={{ background: "#1C2419" }}/>
        <span className="nm">{code === "TBD" ? "Awaiting winner" : `Winner ${code.replace("TBD-", "")}`}</span>
        <span className="sc">—</span>
      </div>
    );
  }
  const t = team(code);
  return (
    <div className={`bracket-team-row ${isWinner === true ? "winner" : isWinner === false ? "loser" : ""}`}>
      <span className="crest" style={{ background: t.color }}>{t.code}</span>
      <span className="nm">{t.name}</span>
      <span className="sc">{score == null ? "—" : score}</span>
    </div>
  );
};

const BracketMatch = ({ m }) => {
  let homeWin = null, awayWin = null;
  if (m.status === "ft" && m.home_score != null) {
    homeWin = m.home_score > m.away_score;
    awayWin = m.away_score > m.home_score;
  }
  return (
    <div className={`bracket-match ${m.status}`}>
      <BracketTeamRow code={m.home} score={m.home_score} isWinner={homeWin}/>
      <BracketTeamRow code={m.away} score={m.away_score} isWinner={awayWin}/>
      {m.time && (
        <div style={{ padding: "6px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-400)", background: "var(--ink-800)", letterSpacing: "0.06em" }}>
          {m.status === "ft" ? "Final" : m.time}
        </div>
      )}
    </div>
  );
};

const BracketSection = () => (
  <section className="section" id="bracket" style={{ background: "rgba(0,0,0,0.22)" }}>
    <div className="container">
      <div className="section-head">
        <div className="left">
          <span className="eyebrow">Knockout stage</span>
          <h2 className="section-title">The <span className="accent">bracket</span></h2>
        </div>
        <span className="match-meta-text">Single elimination from quarterfinals</span>
      </div>
      <Reveal>
        <div className="bracket-shell">
          <div className="bracket">
            <div className="bracket-round">
              <div className="bracket-round-label">Quarterfinals</div>
              {TOURNAMENT.bracket.qf.map((m, i) => <BracketMatch key={i} m={m}/>)}
            </div>
            <div className="bracket-round">
              <div className="bracket-round-label">Semifinals</div>
              {TOURNAMENT.bracket.sf.map((m, i) => <BracketMatch key={i} m={m}/>)}
            </div>
            <div className="bracket-round">
              <div className="bracket-round-label">Final</div>
              {TOURNAMENT.bracket.final.map((m, i) => <BracketMatch key={i} m={m}/>)}
            </div>
            <div className="bracket-round" style={{ justifyContent: "center" }}>
              <div className="bracket-round-label">Champion</div>
              <div className="trophy-cell">
                <img src="ds/assets/icon-trophy.svg" alt=""/>
                <div className="label">Champion</div>
                <div className="winner-name">TBD</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

// ============ TEAMS / ROSTERS ============
const TeamCard = ({ code }) => {
  const t = team(code);
  const roster = TOURNAMENT.rosters[code] || [];
  // Compute record from standings
  const allStandings = [...TOURNAMENT.standings.A, ...TOURNAMENT.standings.B];
  const rec = allStandings.find(r => r.team === code) || { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  const [open, setOpen] = useStateB(false);
  return (
    <div className={`team-card ${open ? "open" : ""}`}>
      <div className="team-card-head" onClick={() => setOpen(!open)}>
        <div className="crest" style={{ background: t.color }}>{t.code}</div>
        <div className="meta">
          <div className="nm">{t.name}</div>
          <div className="sub">Group {t.group} · {roster.length} players · {rec.pts} pts</div>
        </div>
        <span className="toggle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </span>
      </div>
      <div className="team-record">
        <div className="stat"><span className="v tnum">{rec.w}</span><span className="l">Won</span></div>
        <div className="stat"><span className="v tnum">{rec.d}</span><span className="l">Drew</span></div>
        <div className="stat"><span className="v tnum">{rec.l}</span><span className="l">Lost</span></div>
        <div className="stat"><span className="v tnum" style={{color: rec.gf - rec.ga >= 0 ? "var(--brand-lime)" : "var(--red-card)"}}>{rec.gf - rec.ga >= 0 ? "+" : ""}{rec.gf - rec.ga}</span><span className="l">GD</span></div>
      </div>
      <div className="roster-list">
        <div className="roster-inner">
          {roster.map(p => (
            <div className="roster-row" key={p.num}>
              <span className="num">{p.num}</span>
              <span className="nm">{p.name}</span>
              <span className="pos">{p.pos}</span>
              <span className="gls">
                {p.goals > 0 ? <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#A3E635"><circle cx="12" cy="12" r="10"/></svg>
                  {p.goals}
                </> : <span style={{color:"var(--ink-500)"}}>—</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TeamsSection = () => {
  const codes = Object.keys(TOURNAMENT.teams);
  return (
    <section className="section" id="teams">
      <div className="container">
        <div className="section-head">
          <div className="left">
            <span className="eyebrow">8 clubs · 2 groups</span>
            <h2 className="section-title">The <span className="accent">teams</span></h2>
          </div>
          <span className="match-meta-text">Tap a team to see the roster</span>
        </div>
        <Reveal>
          <div className="teams-grid">
            {codes.map(c => <TeamCard key={c} code={c}/>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ============ FOOTER ============
const Footer = () => (
  <footer className="footer">
    <div className="container footer-inner">
      <div className="brandline">
        <img src="ds/assets/logo-mark.svg" alt=""/>
        <span style={{ color: "var(--ink-50)", fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "-0.01em", fontSize: 18, textTransform: "uppercase" }}>Pitch</span>
        <span>Live tournaments, friends &amp; rivals.</span>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        <span>{TOURNAMENT.venue}</span>
        <span style={{ color: "var(--brand-lime)" }}>{TOURNAMENT.weather}</span>
      </div>
    </div>
  </footer>
);

Object.assign(window, { BracketSection, TeamsSection, Footer });
