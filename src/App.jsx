import { useState } from "react";
import "./App.css";

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(1);

  // 仮データ
  // 後で stop_times / trains / stations から作る想定
  const candidates = [
    {
      depTime: "08:28",
      arrTime: "08:52",
      remain: "あと24分",
      destination: "門司港行",
      type: "普通",
      direction: "下り",
    },
    {
      depTime: "08:31",
      arrTime: "08:55",
      remain: "あと27分",
      destination: "門司港行",
      type: "普通",
      direction: "下り",
    },
    {
      depTime: "08:36",
      arrTime: "09:00",
      remain: "あと32分",
      destination: "鳥栖行",
      type: "普通",
      direction: "上り",
    },
  ];

  const main = candidates[selectedIndex];

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">乗り過ごし防止アプリ</h1>
          <p className="subtitle">乗車後に今の電車を特定して到着時刻を確認</p>
        </header>

        <section className="controls">
          <div className="field-group">
            <label className="label" htmlFor="fromStation">
              出発駅
            </label>
            <select id="fromStation" className="select">
              <option>福工大前</option>
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="toStation">
              到着駅
            </label>
            <select id="toStation" className="select">
              <option>博多</option>
            </select>
          </div>
        </section>

        <section className="status-bar">
          <span className="status-label">現在時刻</span>
          <span className="status-time">08:34</span>
        </section>

        <section className="main-section">
          <div className="section-title">本命候補</div>

          <div className="main-card">
            <div className="main-top">
              <div className="arrival-block">
                <div className="arrival-label">到着予定</div>
                <div className="arrival-time">{main.arrTime}</div>
              </div>

              <div className="remain-block">
                <div className="remain-label">残り時間</div>
                <div className="remain-time">{main.remain}</div>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-key">発車時刻</span>
                <span className="detail-value">{main.depTime}</span>
              </div>
              <div className="detail-item">
                <span className="detail-key">行き先</span>
                <span className="detail-value">{main.destination}</span>
              </div>
              <div className="detail-item">
                <span className="detail-key">種別</span>
                <span className="detail-value">{main.type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-key">方向</span>
                <span className="detail-value">{main.direction}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="candidate-section">
          <div className="section-title">候補一覧</div>

          <div className="candidate-list">
            {candidates.map((train, index) => (
              <button
                key={`${train.depTime}-${train.destination}-${index}`}
                className={`candidate-card ${
                  index === selectedIndex ? "active" : ""
                }`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="candidate-time">{train.depTime} 発</div>
                <div className="candidate-destination">{train.destination}</div>
                <div className="candidate-meta">
                  <span>{train.type}</span>
                  <span>{train.direction}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}