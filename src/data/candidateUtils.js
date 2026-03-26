function timeToMinutes(timeStr) {
  if (!timeStr) return null;

  const [hh, mm] = timeStr.split(":").map(Number);
  return hh * 60 + mm;
}

function formatRemain(targetMinutes, nowMinutes) {
  const diff = targetMinutes - nowMinutes;

  if (diff < 0) {
    return `${Math.abs(diff)}分前`;
  }

  return `あと${diff}分`;
}

// stop_times と trains を使って、条件に合う候補列車を作る
export function buildCandidates({
  fromStationId,
  toStationId,
  stopTimes,
  trains,
  nowMinutes,
}) {
  // train_id ごとに stop_times をまとめる
  const trainMap = new Map(trains.map((train) => [train.train_id, train]));

  const stopTimesByTrain = new Map();

  for (const stop of stopTimes) {
    if (!stopTimesByTrain.has(stop.train_id)) {
      stopTimesByTrain.set(stop.train_id, []);
    }
    stopTimesByTrain.get(stop.train_id).push(stop);
  }

  // 出発駅と到着駅の両方に停まる列車だけを対象にする
  const candidates = [];

  for (const [trainId, stops] of stopTimesByTrain.entries()) {
    const fromStop = stops.find((s) => s.station_id === fromStationId);
    const toStop = stops.find((s) => s.station_id === toStationId);

    if (!fromStop || !toStop) continue;
    if (!fromStop.dep_time || !toStop.arr_time) continue;

    // stop_order を使って逆方向の列車を除外する
    if (fromStop.stop_order >= toStop.stop_order) continue;

    const depMinutes = timeToMinutes(fromStop.dep_time);
    const arrMinutes = timeToMinutes(toStop.arr_time);

    if (depMinutes == null || arrMinutes == null) continue;

    const trainInfo = trainMap.get(trainId);
    if (!trainInfo) continue;

    candidates.push({
      trainId,
      depTime: fromStop.dep_time,
      arrTime: toStop.arr_time,
      depMinutes,
      arrMinutes,
      remain: formatRemain(arrMinutes, nowMinutes),
      destination: trainInfo.destination,
      type: trainInfo.train_type,
      direction: trainInfo.direction,
    });
  }

  // 発車時刻順に並べる
  candidates.sort((a, b) => a.depMinutes - b.depMinutes);

  // 現在時刻以降の最初の列車を探す
  const index = candidates.findIndex(
    (c) => c.depMinutes >= nowMinutes
  );

  // 前後の候補数を設定（前2件・後3件）
  const before = 2;
  const after = 3;

  // 表示範囲を計算
  let start = Math.max(0, index - before);
  let end = index + after;

  // 前後の候補だけ抽出して返す
  return candidates.slice(start, end);
}

// 本命候補を決定する関数
// 現在時刻の3分前に最も近い列車を本命候補とする
export function getRecommendedIndex(candidates, nowMinutes, offsetMinutes = 3) {
  if (!candidates.length) return 0;

  // 現在時刻の少し前を基準にする（3分前）
  const target = nowMinutes - offsetMinutes;

  let bestIndex = 0;
  let bestDiff = Infinity;

  // 最も近い列車を探す
  candidates.forEach((candidate, index) => {
    const diff = Math.abs(candidate.depMinutes - target);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function getNowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatNowTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}