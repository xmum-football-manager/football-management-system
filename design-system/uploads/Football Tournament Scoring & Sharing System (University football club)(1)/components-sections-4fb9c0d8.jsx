/* global React, TOURNAMENT, Crest, Reveal, team */
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

// ============ EVENT TICKER ============
const eventGlyph = (type) => {
  switch (type) {
    case "goal":   return <svg width="14" height="14" viewBox="0 0 24 24" fill="#A3E635"><circle cx="12" cy="12" r="10"/><path d="M12 6 L14 10 L18 10 L15 13 L16 17 L12 15 L8 17 L9 13 L6 10 L10 10 Z" fill="#0E1A12"/></svg>;
    case "yellow": return <span style={{ width: 11, height: 14, background: "#F59E0B", borderRadius: 2, display: "inline-block" }}/>;
    case "red":    return <span style={{ width: 11, height: 14, background: "#DC2626", borderRadius: 2, display: "inline-block" }}/>;
    case "sub":    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3E635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h12l-3-3"/><path d="M19 17H7l3 3"/></svg>;
    default: return null;
  }
};

const Ticker = ({ feed }) => {
  const items = [...feed, ...feed]; // double for seamless loop
  return (
    <div className="ticker">
      <div className="ticker-track">
        {items.map((it, i) => (
          <span className="ticker-item" key={i}>
            <span className="ic">{eventGlyph(it.type)}</span>
            <span className="min">{it.min}'</span>
            <span style={{ color: "var(--brand-lime)", fontWeight: 800, fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 12 }}>{it.match}</span>
            <span style={{ color: "var(--ink-200)" }}>{it.text}</span>
            <span className="ticker-sep"/>
          </span>
        ))}
      </div>
    </div>
  );
};

// ============ MATCH CARD ============
const MatchCard = ({ m }) => {
  const home = team(m.home);
  const away = team(m.away);
  const homeWon = m.status === "ft" && m.home_score > m.away_score;
  const awayWon = m.status === "ft" && m.away_score > m.home_score;
  return (
    <div className={`match-card ${m.status}`}>
      <div className="match-card-head">
        {m.status === "live" && <span className="match-status live"><span className="dot"/>LIVE · {m.minute}'</span>}
        {m.status === "ft" && <span className="match-status ft">Full time</span>}
        {m.status === "upcoming" && <span className="match-status upcoming">Upcoming · {m.time}</span>}
        <span className="group">{m.group}</span>
      </div>

      <div className="match-row">
        <div className={`match-team-cell ${homeWon ? "winner" : (awayWon ? "loser" : "")}`}>
          <span className="crest" style={{ background: home.color }}>{home.code}</span>
          <span className="nm">{home.name}</span>
        </div>
        <span className={`sc ${m.status === "upcoming" ? "dim" : ""}`}>
          {m.home_score == null ? "—" : m.home_score}
        </span>
      </div>
      <div className="match-row">
        <div className={`match-team-cell ${awayWon ? "winner" : (homeWon ? "loser" : "")}`}>
          <span className="crest" style={{ background: away.color }}>{away.code}</span>
          <span className="nm">{away.name}</span>
        </div>
        <span className={`sc ${m.status === "upcoming" ? "dim" : ""}`}>
          {m.away_score == null ? "—" : m.away_score}
        </span>
      </div>

      <div className="footer-row">
        <span className="when">{m.pitch}{m.time && m.status === "ft" ? ` · ${m.time}` : ""}</span>
        <span className="arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
        </span>
      </div>
    </div>
  );
};

// ============ FIXTURES SECTION ============
const FixturesSection = () => {
  const [filter, setFilter] = useStateS("all");
  const matches = TOURNAMENT.todayMatches;
  const filtered = matches.filter(m => filter === "all" || m.status === filter);
  return (
    <section className="section" id="fixtures">
      <div className="container">
        <div className="section-head">
          <div className="left">
            <span className="eyebrow">Today · {TOURNAMENT.dayLabel}</span>
            <h2 className="section-title">Matches <span className="accent">today</span></h2>
          </div>
          <div className="right chips">
            {[
              { id: "all", label: "All" },
              { id: "live", label: "Live now" },
              { id: "upcoming", label: "Upcoming" },
              { id: "ft", label: "Full time" },
            ].map(c => (
              <button key={c.id} className={`chip ${filter === c.id ? "active" : ""}`} onClick={() => setFilter(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <Reveal>
          <div className="fixtures-grid">
            {filtered.map(m => <MatchCard key={m.id} m={m}/>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ============ STANDINGS SECTION ============
const StandingsCard = ({ groupId, rows }) => {
  const ref = useRefS(null);
  useEffectS(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { el.classList.add("in"); io.unobserve(el); } });
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const maxPts = Math.max(...rows.map(r => r.pts), 1);
  return (
    <div className="standings-card" ref={ref}>
      <div className="head">
        <div className="group-tag">Group<span className="grp">{groupId}</span></div>
        <span className="legend">Top 2 advance</span>
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = team(r.team);
            return (
              <tr key={r.team} className={i < 2 ? "qualify" : ""}>
                <td>
                  <span className="rank">
                    {i+1}
                    {i < 2 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>}
                  </span>
                </td>
                <td>
                  <div className="team-cell">
                    <span className="crest" style={{ background: t.color }}>{t.code}</span>
                    <span>{t.name}</span>
                  </div>
                </td>
                <td>{r.p}</td>
                <td>{r.w}</td>
                <td>{r.d}</td>
                <td>{r.l}</td>
                <td>{r.gf}</td>
                <td>{r.ga}</td>
                <td>
                  <span className="pts">{r.pts}</span>
                  <div className="pts-bar"><i style={{ "--w": r.pts / maxPts }}/></div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const StandingsSection = () => (
  <section className="section" id="standings" style={{ background: "rgba(0,0,0,0.18)" }}>
    <div className="container">
      <div className="section-head">
        <div className="left">
          <span className="eyebrow">Group stage</span>
          <h2 className="section-title">The <span className="accent">table</span></h2>
        </div>
        <span className="match-meta-text">After 4 of 6 matchdays played</span>
      </div>
      <Reveal>
        <div className="standings-shell">
          <StandingsCard groupId="A" rows={TOURNAMENT.standings.A}/>
          <StandingsCard groupId="B" rows={TOURNAMENT.standings.B}/>
        </div>
      </Reveal>
    </div>
  </section>
);

// ============ SCORERS SECTION ============
const Scorer = ({ s, idx }) => {
  const t = team(s.team);
  const matches = s.perMatch || [];
  const max = Math.max(...matches, 1);
  return (
    <div className={`scorer ${idx === 0 ? "top1" : idx === 1 ? "top2" : idx === 2 ? "top3" : ""}`}>
      <span className="pos">{idx + 1}</span>
      <div className="who">
        <span className="avatar" style={{ background: t.color }}>{s.name.split(" ").map(w => w[0]).slice(0,2).join("")}</span>
        <div>
          <div className="name">{s.name}</div>
          <div className="team-line">
            <span className="crest-mini" style={{ background: t.color }}/>
            {t.name} · #{idx + 1} all comp.
          </div>
        </div>
      </div>
      <div className="goal-bars">
        {matches.map((g, i) => (
          <span key={i} className={g > 0 ? "on" : ""} style={{ height: `${(g / max) * 100 || 8}%`, minHeight: 4 }}/>
        ))}
      </div>
      <span className="total">{s.goals}</span>
    </div>
  );
};

const ScorersSection = () => (
  <section className="section" id="scorers">
    <div className="container">
      <div className="section-head">
        <div className="left">
          <span className="eyebrow">Golden boot race</span>
          <h2 className="section-title">Top <span className="accent">scorers</span></h2>
        </div>
        <span className="match-meta-text">{TOURNAMENT.scorers.length} players on the chart</span>
      </div>
      <Reveal>
        <div className="scorers-list">
          {TOURNAMENT.scorers.map((s, i) => <Scorer key={s.name} s={s} idx={i}/>)}
        </div>
      </Reveal>
    </div>
  </section>
);

Object.assign(window, { Ticker, MatchCard, FixturesSection, StandingsSection, ScorersSection });
