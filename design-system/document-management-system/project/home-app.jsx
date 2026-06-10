/* global React, ReactDOM, HOME, useInView, HomeNav, HomeHero, HomeTicker */
const { useState: useStateH, useEffect: useEffectH } = React;

const IconTeams = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconFormat = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 4-7"/></svg>;
const IconPin = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconStage = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;

const TournamentCard = ({ t, idx }) => {
  const ref = useInView(0.12);
  const badge = t.status === "live"
    ? <span className="badge live"><span className="dot"/>Live · {t.matchesLive} {t.matchesLive === 1 ? "match" : "matches"}</span>
    : t.status === "upcoming"
    ? <span className="badge upcoming">Upcoming</span>
    : <span className="badge finished">Finished</span>;

  return (
    <a ref={ref} className="tcard" href={t.href} style={{ "--tc-accent": t.accent, transitionDelay: `${idx * 60}ms` }}>
      <div className="accent-strip" style={{ background: t.accent }}/>
      <div className="tcard-body">
        <div className="tcard-top">
          {badge}
          <span className="sport-tag">{t.sport}</span>
        </div>

        <div className="tname">{t.name}</div>
        <div className="tedition">{t.edition}</div>

        <div className="meta-rows">
          <div className="meta-row"><IconFormat/>{t.format}</div>
          <div className="meta-row"><IconPin/>{t.venue}</div>
          {t.progress && <div className="meta-row"><IconStage/>{t.progress}</div>}
        </div>

        {t.status === "live" && t.featured && (
          <div className="live-strip">
            <div className="lt-team home">
              <span className="crest" style={{ background: t.featured.homeColor }}>{t.featured.home}</span>
              <span className="nm">{t.featured.home}</span>
            </div>
            <div className="lt-score">
              <span className="sc">{t.featured.hs}–{t.featured.as}</span>
              <span className="min">{t.featured.min}'</span>
            </div>
            <div className="lt-team away">
              <span className="crest" style={{ background: t.featured.awayColor }}>{t.featured.away}</span>
              <span className="nm">{t.featured.away}</span>
            </div>
          </div>
        )}

        {t.status === "upcoming" && (
          <div className="upcoming-strip">
            <span className="when">{t.startsIn}</span>
            <span className="date">{t.startDate}</span>
          </div>
        )}

        {t.status === "finished" && (
          <div className="champ-strip">
            <img src="ds/assets/icon-trophy.svg" alt=""/>
            <div className="ct">
              <span className="lbl">Champion · Final {t.finalScore}</span>
              <span className="nm">{t.champion}</span>
            </div>
            <span className="crest" style={{ background: t.championColor }}>
              {t.champion.split(" ").map(w => w[0]).slice(0,3).join("").toUpperCase()}
            </span>
          </div>
        )}

        <div className="tcard-footer">
          <span className="open">{t.status === "finished" ? "View results" : "Open live view"}</span>
          <span className="arrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
          </span>
        </div>
      </div>
    </a>
  );
};

const TournamentsSection = () => {
  const [filter, setFilter] = useStateH("all");
  useEffectH(() => {
    const onFilter = (e) => setFilter(e.detail || "all");
    window.addEventListener("pitch-filter", onFilter);
    return () => window.removeEventListener("pitch-filter", onFilter);
  }, []);
  const list = HOME.tournaments.filter(t => filter === "all" || t.status === filter);
  const filters = [
    { id: "all", label: "All" },
    { id: "live", label: "Live now" },
    { id: "upcoming", label: "Upcoming" },
    { id: "finished", label: "Finished" },
  ];
  return (
    <section className="home-section" id="tournaments">
      <div className="container">
        <div className="home-section-head">
          <div>
            <span className="eyebrow">{HOME.season}</span>
            <h2>The <span className="accent">tournaments</span></h2>
          </div>
          <div className="home-filters">
            {filters.map(f => (
              <button key={f.id} className={`home-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tournaments-grid">
          {list.map((t, i) => <TournamentCard key={t.id} t={t} idx={i}/>)}
        </div>
        {list.length === 0 && (
          <div className="tournaments-empty">
            <img src="ds/assets/icon-whistle.svg" alt=""/>
            <div className="te-title">No {filter === "live" ? "live" : filter} tournaments</div>
            <p className="te-sub">
              {filter === "live"
                ? "Nothing is kicking off right this second. Browse upcoming fixtures or check back at match time."
                : "Nothing here right now — try a different filter."}
            </p>
            <button className="btn btn-lime" onClick={() => setFilter("all")}>Show all tournaments</button>
          </div>
        )}
      </div>
    </section>
  );
};

const CTABand = () => (
  <section className="home-cta-band">
    <div className="home-cta-inner">
      <div>
        <h2>Never miss a goal.</h2>
        <p>Follow your favorite teams and get a buzz on your phone the moment they score — wherever you are on campus.</p>
      </div>
      <button className="btn btn-dark btn-lg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 11a7 7 0 1 0-14 0c0 7-3 9-3 9h20s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        Get score alerts
      </button>
    </div>
  </section>
);

const HomeFooter = () => (
  <footer className="footer">
    <div className="container footer-inner" style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
      <div className="brandline">
        <img src="ds/assets/logo-mark.svg" alt=""/>
        <span style={{ color: "var(--ink-50)", fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "-0.01em", fontSize: 18, textTransform: "uppercase" }}>Pitch</span>
        <span>Live tournaments, friends &amp; rivals.</span>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        <span>{HOME.org}</span>
        <span style={{ color: "var(--brand-lime)" }}>{HOME.season}</span>
      </div>
    </div>
  </footer>
);

const HomeApp = () => (
  <>
    <HomeNav/>
    <HomeHero/>
    <HomeTicker/>
    <TournamentsSection/>
    <CTABand/>
    <HomeFooter/>
  </>
);

ReactDOM.createRoot(document.getElementById("root")).render(<HomeApp/>);
