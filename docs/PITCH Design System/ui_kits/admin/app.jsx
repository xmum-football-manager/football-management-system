/* global React, ReactDOM, Crest, Icon, OverviewTab, FixturesTab, StandingsTab, BracketTab, TeamsTab, ScorersTab, SettingsTab, LiveScreen */
const { useState } = React;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "fixtures", label: "Fixtures" },
  { id: "standings", label: "Standings" },
  { id: "bracket", label: "Bracket" },
  { id: "teams", label: "Teams" },
  { id: "scorers", label: "Scorers" },
  { id: "settings", label: "Settings" },
];

const StatusBar = () => (
  <div className="statusbar">
    <span>9:41</span>
    <span className="right">
      <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="6" width="3" height="6" rx="0.5"/><rect x="5" y="3" width="3" height="9" rx="0.5"/><rect x="10" y="0" width="3" height="12" rx="0.5"/><rect x="15" y="2" width="3" height="10" rx="0.5" opacity="0.4"/></svg>
      <svg viewBox="0 0 22 12" fill="currentColor"><rect x="0.5" y="0.5" width="18" height="11" rx="2.5" fill="none" stroke="currentColor"/><rect x="2" y="2" width="14" height="8" rx="1.5"/><rect x="19.5" y="4" width="2" height="4" rx="0.5"/></svg>
    </span>
  </div>
);

const Detail = ({ onOpenLive }) => {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <div className="topnav">
        <div className="crumb">
          <button className="back"><Icon name="back"/></button>
          <div className="title">Eastside Cup</div>
        </div>
        <div className="actions">
          <button className="iconbtn"><Icon name="share"/></button>
          <button className="iconbtn"><Icon name="settings"/></button>
        </div>
      </div>

      <div className="livehero-shell" onClick={onOpenLive} role="button" tabIndex={0}>
        <div className="livehero-inner">
          <div className="livehero-top">
            <span className="livehero-pill"><span className="livedot"/>Live now · 67'</span>
            <span className="livehero-meta">Group A · MD9</span>
          </div>
          <div className="livehero-board">
            <div className="livehero-side">
              <Crest code="THU" size={40}/>
              <span className="livehero-nm">Thunderhawks</span>
            </div>
            <div className="livehero-nums"><span>2</span><span className="sep">–</span><span>1</span></div>
            <div className="livehero-side">
              <Crest code="BLZ" size={40}/>
              <span className="livehero-nm">Blazers</span>
            </div>
          </div>
          <div className="livehero-cta">
            <span>Open scorekeeper</span>
            <Icon name="chev" size={14}/>
          </div>
        </div>
      </div>

      <div className="thead">
        <div className="row1">
          <span className="tag active"><span className="livedot" style={{ animation: "none", background: "var(--brand-lime)" }}/>Active</span>
          <span className="tag role">You · Organizer</span>
        </div>
        <h1>Eastside University Cup</h1>
        <div className="meta">8 TEAMS · 16 MATCHES · <strong>FINAL · MON 19:00</strong></div>
      </div>

      <div className="tabstrip">
        {TABS.map(t => (
          <button key={t.id} className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="page">
        {tab === "overview" && <OverviewTab onOpenLive={onOpenLive}/>}
        {tab === "fixtures" && <FixturesTab onOpenLive={onOpenLive}/>}
        {tab === "standings" && <StandingsTab/>}
        {tab === "bracket" && <BracketTab/>}
        {tab === "teams" && <TeamsTab/>}
        {tab === "scorers" && <ScorersTab/>}
        {tab === "settings" && <SettingsTab/>}
      </div>

      {tab === "fixtures" && (
        <button className="fab"><Icon name="plus" size={16}/> Schedule match</button>
      )}
    </>
  );
};

const App = () => {
  const [screen, setScreen] = useState("detail");
  return (
    <div className="app">
      <div className="phone">
        <StatusBar/>
        {screen === "detail" && <Detail onOpenLive={() => setScreen("live")}/>}
        {screen === "live" && <LiveScreen onBack={() => setScreen("detail")}/>}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
