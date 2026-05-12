/* Mock tournament data — Eastside University Cup */
window.TOURNAMENT = {
  name: "Eastside University Cup",
  edition: "Spring 2026",
  venue: "North Field, Eastside Athletics Complex",
  dayLabel: "Matchday 9",
  weather: "62°F · Clear",

  teams: {
    THU: { code: "THU", name: "Thunderhawks",   short: "Thunder",   color: "#DC2626", group: "A" },
    BLZ: { code: "BLZ", name: "Blazers FC",     short: "Blazers",   color: "#F59E0B", group: "A" },
    NRT: { code: "NRT", name: "Northstars",     short: "Northstars",color: "#2563EB", group: "A" },
    GRV: { code: "GRV", name: "Grovers",        short: "Grovers",   color: "#7C3AED", group: "A" },

    KNG: { code: "KNG", name: "Kingfishers",    short: "Kings",     color: "#0891B2", group: "B" },
    OAK: { code: "OAK", name: "Oakwood United", short: "Oakwood",   color: "#DB2777", group: "B" },
    RIV: { code: "RIV", name: "Riverside AC",   short: "Riverside", color: "#65A30D", group: "B" },
    HRB: { code: "HRB", name: "Harbor City",    short: "Harbor",    color: "#18181B", group: "B" },
  },

  // The featured live match
  featured: {
    id: "m-live-01",
    home: "THU", away: "BLZ",
    home_score: 2, away_score: 1,
    minute: 67, period: "2H",
    group: "Group A · Matchday 9",
    pitch: "North Field",
    referee: "M. Alvarez",
    home_form: ["W","W","D","W","L"],
    away_form: ["L","W","W","D","W"],
    possession_home: 58, possession_away: 42,
    shots_home: 11, shots_away: 7,
    shots_on_home: 5, shots_on_away: 3,
    corners_home: 6, corners_away: 4,
    fouls_home: 8,  fouls_away: 11,
    cards_home_y: 1, cards_away_y: 2, cards_home_r: 0, cards_away_r: 0,
    xg_home: 1.84, xg_away: 0.92,

    events: [
      { min: 12, type: "goal",   team: "home", player: "Maya Owens",   assist: "L. Park" },
      { min: 23, type: "yellow", team: "away", player: "K. Suri" },
      { min: 31, type: "goal",   team: "away", player: "Diego Silva" },
      { min: 44, type: "yellow", team: "home", player: "T. Holm" },
      { min: 47, type: "goal",   team: "home", player: "Maya Owens",   assist: "J. Carter" },
      { min: 58, type: "yellow", team: "away", player: "F. Greene" },
      { min: 62, type: "sub",    team: "home", on: "R. Khan", off: "T. Holm" },
    ],
  },

  // Other live + today's matches
  todayMatches: [
    {
      id: "m02", status: "live", minute: 52,
      home: "KNG", away: "OAK",
      home_score: 1, away_score: 1,
      group: "Group B", pitch: "Field 2",
    },
    {
      id: "m03", status: "live", minute: 38,
      home: "NRT", away: "GRV",
      home_score: 0, away_score: 2,
      group: "Group A", pitch: "Field 3",
    },
    {
      id: "m04", status: "ft",
      home: "RIV", away: "HRB",
      home_score: 3, away_score: 0,
      group: "Group B", pitch: "Field 1", time: "10:30",
    },
    {
      id: "m05", status: "upcoming",
      home: "GRV", away: "BLZ",
      home_score: null, away_score: null,
      group: "Group A · QF", pitch: "North Field", time: "16:30",
    },
    {
      id: "m06", status: "upcoming",
      home: "OAK", away: "RIV",
      home_score: null, away_score: null,
      group: "Group B · QF", pitch: "Field 2", time: "17:00",
    },
    {
      id: "m07", status: "upcoming",
      home: "THU", away: "KNG",
      home_score: null, away_score: null,
      group: "QF · Crossover", pitch: "North Field", time: "19:30",
    },
  ],

  standings: {
    A: [
      { team: "THU", p: 4, w: 3, d: 1, l: 0, gf: 9, ga: 3, pts: 10 },
      { team: "GRV", p: 4, w: 2, d: 1, l: 1, gf: 7, ga: 4, pts: 7 },
      { team: "BLZ", p: 4, w: 2, d: 0, l: 2, gf: 6, ga: 6, pts: 6 },
      { team: "NRT", p: 4, w: 0, d: 0, l: 4, gf: 2, ga: 11, pts: 0 },
    ],
    B: [
      { team: "RIV", p: 4, w: 3, d: 1, l: 0, gf: 8, ga: 2, pts: 10 },
      { team: "KNG", p: 4, w: 2, d: 1, l: 1, gf: 6, ga: 5, pts: 7 },
      { team: "OAK", p: 4, w: 1, d: 1, l: 2, gf: 4, ga: 5, pts: 4 },
      { team: "HRB", p: 4, w: 0, d: 1, l: 3, gf: 2, ga: 8, pts: 1 },
    ],
  },

  scorers: [
    { name: "Maya Owens",   team: "THU", goals: 8, perMatch: [1,2,1,0,2,0,0,2] },
    { name: "Diego Silva",  team: "BLZ", goals: 6, perMatch: [0,2,1,1,0,0,1,1] },
    { name: "Lana Park",    team: "THU", goals: 5, perMatch: [1,1,0,1,0,1,1,0] },
    { name: "Sam Reyes",    team: "RIV", goals: 5, perMatch: [0,1,2,0,1,1,0,0] },
    { name: "K. Suri",      team: "BLZ", goals: 4, perMatch: [0,0,1,1,1,0,0,1] },
    { name: "J. Okafor",    team: "GRV", goals: 4, perMatch: [1,0,0,1,1,0,0,1] },
    { name: "M. Tanaka",    team: "KNG", goals: 4, perMatch: [0,1,1,0,0,1,1,0] },
    { name: "P. Andersen",  team: "OAK", goals: 3, perMatch: [0,1,0,1,0,0,1,0] },
  ],

  bracket: {
    qf: [
      { home: "THU", away: "KNG", home_score: null, away_score: null, status: "upcoming", time: "Today · 19:30" },
      { home: "GRV", away: "BLZ", home_score: null, away_score: null, status: "upcoming", time: "Today · 16:30" },
      { home: "RIV", away: "OAK", home_score: null, away_score: null, status: "upcoming", time: "Today · 17:00" },
      { home: "NRT", away: "HRB", home_score: 1,    away_score: 0,    status: "ft" },
    ],
    sf: [
      { home: "TBD-A", away: "TBD-B", home_score: null, away_score: null, status: "scheduled", time: "Sat · 14:00" },
      { home: "TBD-C", away: "NRT",   home_score: null, away_score: null, status: "scheduled", time: "Sat · 16:30" },
    ],
    final: [
      { home: "TBD", away: "TBD", home_score: null, away_score: null, status: "scheduled", time: "Sun · 18:00" },
    ],
  },

  rosters: {
    THU: [
      { num: 1,  name: "C. Vega",     pos: "GK", goals: 0 },
      { num: 4,  name: "T. Holm",     pos: "CB", goals: 1 },
      { num: 5,  name: "R. Khan",     pos: "CB", goals: 0 },
      { num: 8,  name: "J. Carter",   pos: "CM", goals: 2 },
      { num: 10, name: "Lana Park",   pos: "AM", goals: 5 },
      { num: 11, name: "Maya Owens",  pos: "ST", goals: 8 },
      { num: 14, name: "B. Mendez",   pos: "LW", goals: 1 },
      { num: 17, name: "S. Yates",    pos: "RW", goals: 2 },
    ],
    BLZ: [
      { num: 1,  name: "L. Bauer",    pos: "GK", goals: 0 },
      { num: 3,  name: "F. Greene",   pos: "LB", goals: 0 },
      { num: 6,  name: "K. Suri",     pos: "DM", goals: 4 },
      { num: 9,  name: "Diego Silva", pos: "ST", goals: 6 },
      { num: 10, name: "M. Halili",   pos: "AM", goals: 2 },
      { num: 14, name: "O. Pell",     pos: "RW", goals: 1 },
    ],
    NRT: [
      { num: 1,  name: "I. Watts",    pos: "GK", goals: 0 },
      { num: 2,  name: "E. Cho",      pos: "RB", goals: 0 },
      { num: 7,  name: "D. Nair",     pos: "CM", goals: 1 },
      { num: 9,  name: "G. Russo",    pos: "ST", goals: 1 },
    ],
    GRV: [
      { num: 1,  name: "A. Hale",     pos: "GK", goals: 0 },
      { num: 5,  name: "P. Quinn",    pos: "CB", goals: 1 },
      { num: 8,  name: "J. Okafor",   pos: "CM", goals: 4 },
      { num: 11, name: "V. Lopez",    pos: "ST", goals: 2 },
    ],
    KNG: [
      { num: 1,  name: "H. Brand",    pos: "GK", goals: 0 },
      { num: 6,  name: "M. Tanaka",   pos: "AM", goals: 4 },
      { num: 9,  name: "Y. Adesina",  pos: "ST", goals: 2 },
      { num: 13, name: "C. Beck",     pos: "LW", goals: 0 },
    ],
    OAK: [
      { num: 1,  name: "S. Frost",    pos: "GK", goals: 0 },
      { num: 4,  name: "R. Hales",    pos: "CB", goals: 0 },
      { num: 9,  name: "P. Andersen", pos: "ST", goals: 3 },
      { num: 11, name: "T. Lin",      pos: "RW", goals: 1 },
    ],
    RIV: [
      { num: 1,  name: "M. Bauer",    pos: "GK", goals: 0 },
      { num: 6,  name: "Sam Reyes",   pos: "AM", goals: 5 },
      { num: 9,  name: "G. Idris",    pos: "ST", goals: 3 },
    ],
    HRB: [
      { num: 1,  name: "J. Cole",     pos: "GK", goals: 0 },
      { num: 7,  name: "D. Banks",    pos: "CM", goals: 1 },
      { num: 9,  name: "V. Park",     pos: "ST", goals: 1 },
    ],
  },

  // Marquee feed (latest events across all live matches)
  feed: [
    { min: 67, type: "goal",   match: "THU vs BLZ", text: "Owens fires from the edge of the box. 2–1." },
    { min: 52, type: "yellow", match: "KNG vs OAK", text: "Hales booked for a tactical foul." },
    { min: 47, type: "goal",   match: "THU vs BLZ", text: "Owens with the brace. Eastside on top." },
    { min: 38, type: "goal",   match: "NRT vs GRV", text: "Okafor finishes a counter. 2–0 Grovers." },
    { min: 31, type: "goal",   match: "THU vs BLZ", text: "Silva equalizes from the spot." },
    { min: 22, type: "red",    match: "NRT vs GRV", text: "Watts sent off after a second yellow." },
    { min: 12, type: "goal",   match: "THU vs BLZ", text: "Owens opens the scoring on a counter." },
  ],
};
