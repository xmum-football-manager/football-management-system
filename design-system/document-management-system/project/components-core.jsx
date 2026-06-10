/* global React, TOURNAMENT */
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

// ============ HELPERS ============
function team(code) { return TOURNAMENT.teams[code]; }

function initials(name) {
  return name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
}

const Crest = ({ code, size = 32, fontSize }) => {
  const t = team(code);
  if (!t) return <div style={{
    width: size, height: size, borderRadius: 999, background: "#1C2419",
    border: "1px dashed #2E3729",
  }}/>;
  const fs = fontSize || Math.round(size * 0.34);
  return (
    <span className="crest" style={{
      width: size, height: size, background: t.color, fontSize: fs,
      borderRadius: 999, display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      color: t.color === "#FFFFFF" ? "#0E1A12" : "#fff",
      fontFamily: "var(--font-display)",
      fontWeight: 900,
      boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.12)",
      flexShrink: 0,
    }}>{t.code}</span>
  );
};

// ============ INTERSECTION REVEAL ============
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

const Reveal = ({ children, as = "div", className = "", delay = 0, style = {}, ...rest }) => {
  const ref = useReveal();
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
};

// ============ TOP NAV ============
const TopNav = () => (
  <header className="topnav">
    <div className="topnav-inner">
      <a className="topnav-brand" href="Home.html" style={{ textDecoration: "none", color: "inherit" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 2 }}><path d="m15 18-6-6 6-6"/></svg>
        <img src="ds/assets/logo-mark.svg" alt="Pitch"/>
        <span className="name">Pitch</span>
        <span className="topnav-tourney">{TOURNAMENT.name} · <span style={{color:"var(--brand-lime)"}}>{TOURNAMENT.edition}</span></span>
      </a>
      <div className="topnav-actions">
        <button className="btn" aria-label="Search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <span style={{display:"none"}} className="hide-sm">Search</span>
        </button>
        <button className="btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>
          <span>Share</span>
        </button>
        <button className="btn btn-lime">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Follow
        </button>
      </div>
    </div>
  </header>
);

// ============ STICKY TAB STRIP ============
const TABS = [
  { id: "live",      label: "Live" },
  { id: "fixtures",  label: "Fixtures" },
  { id: "standings", label: "Standings" },
  { id: "scorers",   label: "Top scorers" },
  { id: "bracket",   label: "Bracket" },
  { id: "teams",     label: "Teams" },
];

const TabStrip = () => {
  const [active, setActive] = useState("live");
  const tabRefs = useRef({});
  const stripRef = useRef(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  // Update indicator on resize / active change
  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    const strip = stripRef.current;
    if (!el || !strip) return;
    const er = el.getBoundingClientRect();
    const sr = strip.getBoundingClientRect();
    setIndicator({ x: (er.left - sr.left) + strip.scrollLeft, w: er.width });
  }, [active]);

  // Update on scrollspy
  useEffect(() => {
    const sectionIds = TABS.map(t => t.id);
    const handler = () => {
      // Find the section closest to top (with offset for sticky nav)
      const offset = 200;
      let curr = "live";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - offset <= 0) curr = id;
      }
      setActive((prev) => prev !== curr ? curr : prev);
    };
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const onTabClick = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div className="tabstrip-wrap">
      <div className="tabstrip" ref={stripRef}>
        {TABS.map(t => (
          <button
            key={t.id}
            ref={(el) => tabRefs.current[t.id] = el}
            className={`tab ${active === t.id ? "active" : ""}`}
            onClick={() => onTabClick(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="tab-indicator" style={{
          transform: `translateX(${indicator.x}px)`,
          width: indicator.w,
        }}/>
      </div>
    </div>
  );
};

// ============ HERO LIVE ============
const ScoreDigit = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const [tick, setTick] = useState(false);
  useEffect(() => {
    if (display !== value) {
      setTick(true);
      setDisplay(value);
      const t = setTimeout(() => setTick(false), 900);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span className="score-digit-wrap">
      <span className={`score-digit ${tick ? "tick" : ""}`}>{display}</span>
    </span>
  );
};

const FormStrip = ({ form, align }) => (
  <div className="team-form" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
    {form.map((r, i) => (
      <span key={i} className={`form-pip ${r}`}>{r}</span>
    ))}
  </div>
);

const ScorerLine = ({ ev, side }) => (
  <div className={`scorer-line ${side}`}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#A3E635" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6 L14 10 L18 10 L15 13 L16 17 L12 15 L8 17 L9 13 L6 10 L10 10 Z" fill="#0E1A12"/>
    </svg>
    <span className="who">{ev.player}</span>
    <span className="min tnum">{ev.min}'</span>
  </div>
);

const HeroLive = ({ data, clock }) => {
  const home = team(data.home);
  const away = team(data.away);
  const homeStr = String(data.home_score);
  const awayStr = String(data.away_score);

  const homeGoals = (data.events || []).filter(e => e.type === "goal" && e.team === "home");
  const awayGoals = (data.events || []).filter(e => e.type === "goal" && e.team === "away");

  return (
    <section className="hero" id="live">
      <div className="hero-inner">
        <div className="hero-meta">
          <span className="live-pill">
            <span className="live-dot"/>
            Live · Matchday 9
          </span>
          <span className="match-meta-text">
            <strong>{data.group}</strong> &middot; {data.pitch} &middot; Ref {data.referee}
          </span>
        </div>

        <div className="scoreboard">
          <div className="team-side home">
            <div className="team-crest" style={{ background: home.color }}>{home.code}</div>
            <div className="team-side-meta">
              <div className="team-name">{home.name}</div>
              <div className="team-tag">{home.code} · GROUP {home.group}</div>
              <FormStrip form={data.home_form} align="right"/>
            </div>
          </div>

          <div className="score-column">
            <div className="score-display">
              <ScoreDigit value={homeStr}/>
              <span className="sep">–</span>
              <ScoreDigit value={awayStr}/>
            </div>
            <div className="match-clock">
              <span className="clock-ball"/>
              <span className="period">{data.period}</span>
              <span className="tnum">{clock}</span>
            </div>
          </div>

          <div className="team-side away">
            <div className="team-crest" style={{ background: away.color }}>{away.code}</div>
            <div className="team-side-meta">
              <div className="team-name">{away.name}</div>
              <div className="team-tag">{away.code} · GROUP {away.group}</div>
              <FormStrip form={data.away_form} align="left"/>
            </div>
          </div>
        </div>

        <div className="hero-scorers">
          <div className="scorers-col home" data-label={home.short || home.name}>
            {homeGoals.length === 0 && <span className="empty">No goals yet</span>}
            {homeGoals.map((ev, i) => <ScorerLine key={i} ev={ev} side="home"/>)}
          </div>
          <div className="scorers-divider" aria-hidden="true"/>
          <div className="scorers-col away" data-label={away.short || away.name}>
            {awayGoals.length === 0 && <span className="empty">No goals yet</span>}
            {awayGoals.map((ev, i) => <ScorerLine key={i} ev={ev} side="away"/>)}
          </div>
        </div>

      </div>
    </section>
  );
};

Object.assign(window, { Crest, Reveal, useReveal, TopNav, TabStrip, HeroLive, team, initials });
