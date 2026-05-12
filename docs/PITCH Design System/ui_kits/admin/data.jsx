/* global React */
const { useState } = React;

const TEAMS = {
  THU: { code: "THU", name: "Thunderhawks", color: "#DC2626" },
  GRV: { code: "GRV", name: "Grovers", color: "#7C3AED" },
  BLZ: { code: "BLZ", name: "Blazers FC", color: "#F59E0B" },
  NRT: { code: "NRT", name: "Northstars", color: "#2563EB" },
  KNG: { code: "KNG", name: "Kingfishers", color: "#0891B2" },
  OAK: { code: "OAK", name: "Oakwood", color: "#DB2777" },
  RIV: { code: "RIV", name: "Rivertons", color: "#FFFFFF" },
  HRB: { code: "HRB", name: "Harborside", color: "#18181B" },
};
const team = (c) => TEAMS[c] || { code: c, name: c, color: "#444" };

const Crest = ({ code, size = 24 }) => {
  const t = team(code);
  return (
    <span className="crest" style={{ background: t.color, width: size, height: size, fontSize: Math.max(8, size * 0.36), color: t.color === "#FFFFFF" ? "#0E1A12" : "#fff" }}>{t.code}</span>
  );
};

const Icon = ({ name, size = 16 }) => {
  const paths = {
    back: <path d="M15 18l-6-6 6-6"/>,
    share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></>,
    plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
    more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    chev: <path d="M9 18l6-6-6-6"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
  );
};

window.TEAMS = TEAMS;
window.team = team;
window.Crest = Crest;
window.Icon = Icon;
