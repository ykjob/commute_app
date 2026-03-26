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
  const [trains, setTrains] = useState([]);
  const [stopTimes, setStopTimes] = useState([]);

  const [fromStationId, setFromStationId] = useState("shingu_chuo");
  const [toStationId, setToStationId] = useState("hakata");

  const [candidates, setCandidates] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(formatNowTime());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 初回表示時に stations / trains / stopTimes をまとめて読み込む
  // 3種類のCSVを先に読み込んでから画面表示する
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
        setTrains(trainData);
        setStopTimes(stopTimeData);
        setCurrentTime(formatNowTime(new Date()));
      } catch (err) {
        console.error(err);
        setError("CSVの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  // 駅選択後、現在時刻をもとに候補列車を再計算する
  // 候補生成と本命候補の決定をここで行う
  useEffect(() => {
    if (!stations.length || !trains.length || !stopTimes.length) return;
    if (!fromStationId || !toStationId) return;

    if (fromStationId === toStationId) {
      setCandidates([]);
      setSelectedIndex(0);
      return;
    }

    try {
      // 現在時刻を取得し、分単位に変換
      const now = new Date();
      const nowMinutes = getNowMinutes(now);

      // 出発駅・到着駅・現在時刻を元に候補列車を作成
      const builtCandidates = buildCandidates({
        fromStationId,
        toStationId,
        stopTimes,
        trains,
        nowMinutes,
      });

      // 現在時刻の3分前を基準に、本命候補の位置を決定
      setCandidates(builtCandidates);

      const recommendedIndex = getRecommendedIndex(
        builtCandidates,
        nowMinutes,
        3
      );
      setSelectedIndex(recommendedIndex);

      setCurrentTime(formatNowTime(now));
    } catch (err) {
      console.error(err);
      setError("候補生成に失敗しました。");
    }
  }, [stations, trains, stopTimes, fromStationId, toStationId]);

  const fromStation = stations.find((s) => s.station_id === fromStationId);
  const toStation = stations.find((s) => s.station_id === toStationId);
  const main = candidates[selectedIndex];

  if (loading) {
    return (
      <div className="app">
        <div className="container">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="container">{error}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <section className="status-bar top">
          <span className="status-label">現在時刻</span>
          <span className="status-time">{currentTime}</span>
        </section>

        <section className="controls">
          <div className="field-group">
            <label className="label" htmlFor="fromStation">
              出発駅
            </label>
            <select
              id="fromStation"
              className="select-input"
              value={fromStationId}
              onChange={(e) => setFromStationId(e.target.value)}
            >
              {stations.map((station) => (
                <option key={station.station_id} value={station.station_id}>
                  {station.station_name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="label" htmlFor="toStation">
              到着駅
            </label>
            <select
              id="toStation"
              className="select-input"
              value={toStationId}
              onChange={(e) => setToStationId(e.target.value)}
            >
              {stations.map((station) => (
                <option key={station.station_id} value={station.station_id}>
                  {station.station_name}
                </option>
              ))}
            </select>
          </div>
        </section>

        

        {fromStationId === toStationId ? (
          <div className="empty-message">
            出発駅と到着駅が同じです。別の駅を選んでください。
          </div>
        ) : candidates.length === 0 ? (
          <div className="empty-message">
            条件に合う候補列車が見つかりませんでした。
          </div>
        ) : (
          <>
            <section className="main-section">
              

              <div className="main-card">
                <div className="main-top">
                  <div className="arrival-block">
                    <div className="arrival-label">目的地到着予定</div>
                    <div className="arrival-time">{main.arrTime}</div>
                  </div>

                  <div className="remain-block">
                    <div className="remain-label">　</div>
                    <div className="remain-time">{main.remain}</div>
                  </div>
                </div>

                <div className="detail-grid">
                  
                  <div className="detail-item">
                  
                    <span className="detail-key">発車時刻</span>
                    <span className="detail-value">{main.depTime}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-key">行先</span>
                    <span className="detail-value">{main.destination}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-key">出発駅</span>
                    <span className="detail-value">
                      {fromStation?.station_name ?? fromStationId}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-key">到着駅</span>
                    <span className="detail-value">
                      {toStation?.station_name ?? toStationId}
                    </span>
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
                    className={`candidate-card ${
                      index === selectedIndex ? "active" : ""
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <div className="candidate-time">{train.depTime} 発</div>
                    <div className="candidate-destination">
                      {train.destination}
                    </div>
                    <div className="candidate-meta">
                      <span>{train.type}</span>
                      <span>{train.direction}</span>
                    </div>
                    <div className="candidate-arrival">到着 {train.arrTime}</div>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}