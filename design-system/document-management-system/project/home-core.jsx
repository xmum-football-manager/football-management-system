/* global React, ReactDOM, HOME */
const { useState, useEffect, useRef } = React;

// ---------- Reveal hook (bulletproof) ----------
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      el.classList.add("in");
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
    const check = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh * 0.9 && r.bottom > 0) reveal();
    };
    // initial check (covers above-the-fold cards immediately)
    check();
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    // safety: never leave content hidden
    const t = setTimeout(reveal, 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
  }, []);
  return ref;
}

// ---------- TOP NAV ----------
const HomeNav = () => (
  <header className="topnav">
    <div className="topnav-inner">
      <div className="topnav-brand">
        <img src="ds/assets/logo-mark.svg" alt="Pitch"/>
        <span className="name">Pitch</span>
        <span className="topnav-tourney">{HOME.org} · <span style={{color:"var(--brand-lime)"}}>{HOME.season}</span></span>
      </div>
      <div className="topnav-actions">
        <button className="btn" aria-label="Search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </button>
        <button className="btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11a7 7 0 1 0-14 0c0 7-3 9-3 9h20s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Follow
        </button>
      </div>
    </div>
  </header>
);

// ---------- HERO LIVE PANEL ----------
const HeroLivePanel = () => {
  const liveTs = HOME.tournaments.filter(t => t.status === "live" && t.featured);
  const hasLive = liveTs.length > 0;
  const upcoming = HOME.tournaments.filter(t => t.status === "upcoming");
  const finished = HOME.tournaments.filter(t => t.status === "finished");

  const [matches, setMatches] = useState(() => liveTs.map(t => ({
    id: t.id, name: t.name, accent: t.accent, f: { ...t.featured }, bump: null,
  })));

  // Tick minutes; occasionally bump a score (live mode only)
  useEffect(() => {
    if (!hasLive) return;
    const id = setInterval(() => {
      setMatches(ms => ms.map(m => {
        const next = { ...m, f: { ...m.f, min: Math.min(90, m.f.min + 1) }, bump: null };
        if (Math.random() < 0.12) {
          const homeGoal = Math.random() < 0.5;
          next.f = { ...next.f, hs: m.f.hs + (homeGoal ? 1 : 0), as: m.f.as + (homeGoal ? 0 : 1) };
          next.bump = homeGoal ? "home" : "away";
        }
        return next;
      }));
    }, 3000);
    return () => clearInterval(id);
  }, [hasLive]);

  // ---- LIVE MODE ----
  if (hasLive) {
    return (
      <aside className="home-hero-aside">
        <div className="live-panel">
          <div className="live-panel-head">
            <span className="lph-title"><span className="live-dot"/>Live now</span>
            <span className="lph-count">{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
          </div>
          <div className="live-panel-body">
            {matches.map(m => (
              <a className="lp-match" href="Live Tournament.html" key={m.id} style={{ "--lp-accent": m.accent }}>
                <div className="lp-tourney">{m.name}</div>
                <div className="lp-score-row">
                  <div className="lp-team home">
                    <span className="crest" style={{ background: m.f.homeColor }}>{m.f.home}</span>
                  </div>
                  <div className="lp-score">
                    <span className={`sc ${m.bump === "home" ? "pop" : ""}`}>{m.f.hs}</span>
                    <span className="dash">–</span>
                    <span className={`sc ${m.bump === "away" ? "pop" : ""}`}>{m.f.as}</span>
                  </div>
                  <div className="lp-team away">
                    <span className="crest" style={{ background: m.f.awayColor }}>{m.f.away}</span>
                  </div>
                </div>
                <div className="lp-min"><span className="ball"/>{m.f.min}'</div>
              </a>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // ---- NO LIVE: UP NEXT (or latest results) ----
  const showUpcoming = upcoming.length > 0;
  const rows = showUpcoming ? upcoming.slice(0, 3) : finished.slice(0, 3);

  return (
    <aside className="home-hero-aside">
      <div className="live-panel">
        <div className="live-panel-head">
          <span className="lph-title">
            <span className="idle-dot"/>{showUpcoming ? "Up next" : "Latest results"}
          </span>
          <span className="lph-count">No matches live</span>
        </div>
        <div className="live-panel-body">
          {rows.map(t => (
            <a className="lp-row" href="Live Tournament.html" key={t.id} style={{ "--lp-accent": t.accent }}>
              <div className="lp-row-main">
                <div className="lp-tourney left">{t.name}</div>
                <div className="lp-row-sub">{t.format}</div>
              </div>
              {showUpcoming ? (
                <div className="lp-date">
                  <span className="d">{t.startDate}</span>
                  <span className="s">{t.startsIn ? t.startsIn.replace("Starts ", "") : "Scheduled"}</span>
                </div>
              ) : (
                <div className="lp-result">
                  <span className="winner" style={{ color: t.championColor }}>
                    {t.champion.split(" ").map(w => w[0]).slice(0,3).join("").toUpperCase()}
                  </span>
                  <span className="fs">{t.finalScore}</span>
                </div>
              )}
            </a>
          ))}
          {rows.length === 0 && (
            <div className="lp-empty">
              <img src="ds/assets/icon-whistle.svg" alt=""/>
              <span>No fixtures scheduled yet.<br/>Check back soon.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

// ---------- HERO ----------
const HomeHero = () => {
  const liveCount = HOME.tournaments.filter(t => t.status === "live").length;
  const upcomingCount = HOME.tournaments.filter(t => t.status === "upcoming").length;
  const hasLive = liveCount > 0;
  const s = HOME.stats;
  const [counts, setCounts] = useState({ tournaments: 0, teams: 0, matchesToday: 0, goalsThisWeek: 0 });

  useEffect(() => {
    const target = s;
    const dur = 900, start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      setCounts({
        tournaments: Math.round(target.tournaments * ease),
        teams: Math.round(target.teams * ease),
        matchesToday: Math.round(target.matchesToday * ease),
        goalsThisWeek: Math.round(target.goalsThisWeek * ease),
      });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const jumpTo = (filter) => {
    window.dispatchEvent(new CustomEvent("pitch-filter", { detail: filter }));
    const el = document.getElementById("tournaments");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  };

  return (
    <section className="home-hero">
      <div className="home-hero-inner">
        <div className="home-hero-main">
        <span className={`kicker ${hasLive ? "" : "idle"}`}>
          <span className={hasLive ? "live-dot" : "idle-dot"}/>
          {hasLive
            ? `${liveCount} ${liveCount === 1 ? "tournament" : "tournaments"} live right now`
            : (upcomingCount > 0 ? `No live matches — ${upcomingCount} ${upcomingCount === 1 ? "tournament" : "tournaments"} coming up` : "Season schedule")}
        </span>
        <h1>Every match.<br/><span className="accent">One campus.</span></h1>
        <p className="lede">Live scores, standings, rosters and brackets for every tournament across Eastside — updated in real time as the whistle blows.</p>
        <div className="hero-cta">
          <a className="btn btn-lime btn-lg" href="#tournaments">
            Browse tournaments
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
          </a>
          {hasLive ? (
            <button className="btn btn-lg" onClick={() => jumpTo("live")}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--red-card)", display: "inline-block", animation: "pitchPulse 1.6s infinite" }}/>
              Watch live now
            </button>
          ) : (
            <button className="btn btn-lg" onClick={() => jumpTo(upcomingCount > 0 ? "upcoming" : "all")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              {upcomingCount > 0 ? "See what's coming up" : "See the schedule"}
            </button>
          )}
        </div>

        <div className="home-stats">
          <div className="home-stat"><div className="v tnum">{counts.tournaments}</div><div className="l">Active tournaments</div></div>
          <div className="home-stat"><div className="v tnum">{counts.teams}</div><div className="l">Teams competing</div></div>
          <div className="home-stat"><div className="v tnum">{counts.matchesToday}</div><div className="l">Matches today</div></div>
          <div className="home-stat"><div className="v tnum">{counts.goalsThisWeek}</div><div className="l">Goals this week</div></div>
        </div>
        </div>
        <HeroLivePanel/>
      </div>
    </section>
  );
};

// ---------- TICKER ----------
const HomeTicker = () => {
  const items = [...HOME.feed, ...HOME.feed];
  return (
    <div className="home-ticker">
      <div className="home-ticker-track">
        {items.map((it, i) => (
          <span className="home-ticker-item" key={i}>
            <span className="tag">{it.tag}</span>
            <span>{it.text}</span>
            <span className="home-ticker-sep"/>
          </span>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { useInView, HomeNav, HomeHero, HeroLivePanel, HomeTicker });
