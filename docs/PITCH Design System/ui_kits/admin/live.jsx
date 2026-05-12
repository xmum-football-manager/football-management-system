/* global React, Crest, Icon, team */
const { useState: useStateL } = React;

const LiveScreen = ({ onBack }) => (
  <>
    <div className="topnav">
      <div className="crumb">
        <button className="back" onClick={onBack}><Icon name="back"/></button>
        <div className="title">Live · MD9</div>
      </div>
      <div className="actions">
        <button className="iconbtn"><Icon name="share"/></button>
        <button className="iconbtn"><Icon name="more"/></button>
      </div>
    </div>
    <div className="page">
      <div className="livehero">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="pill"><span className="livedot"/>Live</span>
          <span className="clock"><span className="ph">2H</span>67:12</span>
        </div>
        <div className="meta">Group A · Matchday 9 · North Field · Ref M. Alvarez</div>
        <div className="scoreboard">
          <div className="sbteam"><Crest code="THU" size={44}/><span className="nm">Thunderhawks</span></div>
          <div className="sbnums"><span>2</span><span className="sep">–</span><span>1</span></div>
          <div className="sbteam"><Crest code="BLZ" size={44}/><span className="nm">Blazers</span></div>
        </div>
      </div>

      <div>
        <div className="shead"><h2>Match events</h2></div>
        <div className="events" style={{ marginTop: 10 }}>
          <div className="event">
            <img className="ico" src="assets/icon-ball.svg" alt=""/>
            <span className="min">67'</span>
            <span className="desc"><strong>M. Owens</strong> fires from the edge of the box. <strong>2 – 1.</strong></span>
          </div>
          <div className="event yc">
            <span className="ico"></span>
            <span className="min">54'</span>
            <span className="desc"><strong>D. Hales</strong> booked for a tactical foul.</span>
          </div>
          <div className="event">
            <img className="ico" src="assets/icon-ball.svg" alt=""/>
            <span className="min">38'</span>
            <span className="desc"><strong>A. Mensah</strong> heads home from the corner. <strong>1 – 1.</strong></span>
          </div>
          <div className="event rc">
            <span className="ico"></span>
            <span className="min">22'</span>
            <span className="desc"><strong>I. Watts</strong> sent off after a second yellow.</span>
          </div>
          <div className="event">
            <img className="ico" src="assets/icon-ball.svg" alt=""/>
            <span className="min">12'</span>
            <span className="desc"><strong>M. Owens</strong> tucks in a rebound. <strong>1 – 0.</strong></span>
          </div>
        </div>
      </div>

      <div>
        <div className="shead"><h2>Scorekeeper actions</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <button className="btn primary" style={{ padding: "14px 16px", fontSize: 13 }}>+ Goal</button>
          <button className="btn" style={{ padding: "14px 16px", fontSize: 13, background: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.45)", color: "#FCD34D" }}>+ Yellow</button>
          <button className="btn" style={{ padding: "14px 16px", fontSize: 13, background: "rgba(220,38,38,0.16)", borderColor: "rgba(220,38,38,0.45)", color: "#FCA5A5" }}>+ Red</button>
          <button className="btn" style={{ padding: "14px 16px", fontSize: 13 }}>+ Sub</button>
          <button className="btn ghost" style={{ padding: "14px 16px", fontSize: 13, gridColumn: "1 / -1" }}>Half time · 45'</button>
        </div>
      </div>
    </div>
  </>
);

window.LiveScreen = LiveScreen;
