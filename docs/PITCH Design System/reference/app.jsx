/* global React, ReactDOM, TOURNAMENT, TopNav, TabStrip, HeroLive, Ticker, FixturesSection, StandingsSection, ScorersSection, BracketSection, TeamsSection, Footer, team */
const { useState, useEffect, useRef, useMemo } = React;

// ============ GOAL TOAST ============
const GoalToast = ({ data, onDone }) => {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2400);
    const t2 = setTimeout(onDone, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={`goal-toast ${out ? "out" : ""}`}>
      <span className="shout">GOAL!</span>
      <span className="who">{data.player} · {data.teamName} {data.minute}'</span>
    </div>
  );
};

// ============ CONFETTI ============
const launchConfetti = () => {
  const colors = ["#A3E635", "#C6F455", "#84CC16", "#F4F7EE", "#DC2626", "#F59E0B"];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 80;
    const startY = 110;
    piece.style.left = startX + "px";
    piece.style.top = startY + "px";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--cx", `${(Math.random() - 0.5) * 600}px`);
    piece.style.setProperty("--cy", `${Math.random() * 500 + 200}px`);
    piece.style.setProperty("--cr", `${(Math.random() - 0.5) * 720}deg`);
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1500);
  }
};

// ============ APP ============
const App = () => {
  const [match, setMatch] = useState(() => ({ ...TOURNAMENT.featured }));
  const [clockSec, setClockSec] = useState(67 * 60 + 12);
  const [toasts, setToasts] = useState([]);
  const [feed, setFeed] = useState(TOURNAMENT.feed);

  // Tick the clock every second
  useEffect(() => {
    const id = setInterval(() => setClockSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Score random goals only — no other auto stats (manually-recorded data)
  useEffect(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.5) {
        const homeTeam = Math.random() < 0.55;
        const t = homeTeam ? team(match.home) : team(match.away);
        const players = TOURNAMENT.rosters[t.code] || [];
        const scorer = players[Math.floor(Math.random() * players.length)] || { name: "Unknown" };
        const minute = Math.floor(clockSec / 60);
        setMatch(m => ({
          ...m,
          home_score: homeTeam ? m.home_score + 1 : m.home_score,
          away_score: !homeTeam ? m.away_score + 1 : m.away_score,
          events: [...(m.events || []), { min: minute, type: "goal", team: homeTeam ? "home" : "away", player: scorer.name }],
        }));
        const tid = Date.now();
        setToasts(ts => [...ts, { id: tid, player: scorer.name, teamName: t.short, minute }]);
        setFeed(f => [{ min: minute, type: "goal", match: `${team(match.home).code} vs ${team(match.away).code}`, text: `${scorer.name} finds the net.` }, ...f].slice(0, 18));
        launchConfetti();
      }
    }, 11000);
    return () => clearInterval(id);
  }, [clockSec, match.home, match.away]);

  const clockStr = useMemo(() => {
    const m = Math.floor(clockSec / 60).toString().padStart(2, "0");
    const s = (clockSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [clockSec]);

  const removeToast = (id) => setToasts(ts => ts.filter(t => t.id !== id));

  return (
    <>
      <TopNav/>
      <TabStrip/>
      <HeroLive data={match} clock={clockStr}/>
      <Ticker feed={feed}/>
      <FixturesSection/>
      <StandingsSection/>
      <ScorersSection/>
      <BracketSection/>
      <TeamsSection/>
      <Footer/>

      {toasts.map(t => (
        <GoalToast key={t.id} data={t} onDone={() => removeToast(t.id)}/>
      ))}
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
