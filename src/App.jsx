import { useEffect, useState } from "react";
import "./App.css";
import { loadStations } from "./data/stations";
import { loadTrains } from "./data/trains";
import { loadStopTimes } from "./data/stopTimes";
import {
  buildCandidates,
  getRecommendedIndex,
  getNowMinutes,
  formatNowTime,
} from "./data/candidateUtils";

export default function App() {
  const [stations, setStations] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(formatNowTime());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fromStationId = "shingu_chuo";
  const toStationId = "hakata";

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        const [stationData, trainData, stopTimeData] = await Promise.all([
          loadStations(),
          loadTrains(),
          loadStopTimes(),
        ]);

        setStations(stationData);

        const now = new Date();
        const nowMinutes = getNowMinutes(now);

        const builtCandidates = buildCandidates({
          fromStationId,
          toStationId,
          stopTimes: stopTimeData,
          trains: trainData,
          nowMinutes,
        });

        setCandidates(builtCandidates);

        const recommendedIndex = getRecommendedIndex(builtCandidates, nowMinutes, 3);
        setSelectedIndex(recommendedIndex);

        setCurrentTime(formatNowTime(now));
      } catch (err) {
        console.error(err);
        setError("CSVの読み込みまたは候補生成に失敗しました。");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const fromStation = stations.find((s) => s.station_id === fromStationId);
  const toStation = stations.find((s) => s.station_id === toStationId);
  const main = candidates[selectedIndex];

  if (loading) {
    return <div className="app"><div className="container">読み込み中...</div></div>;
  }

  if (error) {
    return <div className="app"><div className="container">{error}</div></div>;
  }

  if (!candidates.length) {
    return (
      <div className="app">
        <div className="container">
          条件に合う候補列車が見つかりませんでした。
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">乗り過ごし防止アプリ</h1>
          <p className="subtitle">乗車後に今の電車を特定して到着時刻を確認</p>
        </header>

        <section className="controls">
          <div className="field-group">
            <label className="label">出発駅</label>
            <div className="select">{fromStation?.station_name ?? fromStationId}</div>
          </div>

          <div className="field-group">
            <label className="label">到着駅</label>
            <div className="select">{toStation?.station_name ?? toStationId}</div>
          </div>
        </section>

        <section className="status-bar">
          <span className="status-label">現在時刻</span>
          <span className="status-time">{currentTime}</span>
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
                key={`${train.trainId}-${index}`}
                className={`candidate-card ${index === selectedIndex ? "active" : ""}`}
                onClick={() => setSelectedIndex(index)}
              >
                <div className="candidate-time">{train.depTime} 発</div>
                <div className="candidate-destination">{train.destination}</div>
                <div className="candidate-meta">
                  <span>{train.type}</span>
                  <span>{train.direction}</span>
                </div>
                <div className="candidate-arrival">到着 {train.arrTime}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}