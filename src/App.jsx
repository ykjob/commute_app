import { useState } from "react";
import "./App.css";

export default function App() {
  const [selected, setSelected] = useState(0);

  // 仮データ（あとでロジック差し替え）
  const candidates = [
    { time: "08:32", train: "快速", remain: "あと5分" },
    { time: "08:45", train: "普通", remain: "あと18分" },
    { time: "09:02", train: "快速", remain: "あと35分" },
  ];

  const main = candidates[selected];

  return (
    <div className="app">
      {/* 駅選択 */}
      <div className="header">
        <select className="select">
          <option>出発駅</option>
        </select>
        <select className="select">
          <option>到着駅</option>
        </select>
      </div>

      {/* 本命表示 */}
      <div className="main-card">
        <div className="time">{main.time}</div>
        <div className="train">{main.train}</div>
        <div className="remain">{main.remain}</div>
      </div>

      {/* 候補リスト */}
      <div className="list">
        {candidates.map((c, i) => (
          <div
            key={i}
            className={`item ${i === selected ? "active" : ""}`}
            onClick={() => setSelected(i)}
          >
            <div>{c.time}</div>
            <div>{c.train}</div>
          </div>
        ))}
      </div>

      {/* フッター */}
      <div className="footer">
        現在時刻：08:27
      </div>
    </div>
  );
}
