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

export function buildCandidates({
  fromStationId,
  toStationId,
  stopTimes,
  trains,
  nowMinutes,
}) {
  const trainMap = new Map(trains.map((train) => [train.train_id, train]));

  const stopTimesByTrain = new Map();

  for (const stop of stopTimes) {
    if (!stopTimesByTrain.has(stop.train_id)) {
      stopTimesByTrain.set(stop.train_id, []);
    }
    stopTimesByTrain.get(stop.train_id).push(stop);
  }

  const candidates = [];

  for (const [trainId, stops] of stopTimesByTrain.entries()) {
    const fromStop = stops.find((s) => s.station_id === fromStationId);
    const toStop = stops.find((s) => s.station_id === toStationId);

    if (!fromStop || !toStop) continue;
    if (!fromStop.dep_time || !toStop.arr_time) continue;

    // 逆方向を除外
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

  candidates.sort((a, b) => a.depMinutes - b.depMinutes);

  // 現在時刻に一番近い列車の位置
  const index = candidates.findIndex(
    (c) => c.depMinutes >= nowMinutes
  );

  // 前2件 + 後3件
  const before = 2;
  const after = 3;

  let start = Math.max(0, index - before);
  let end = index + after;

  return candidates.slice(start, end);
}

export function getRecommendedIndex(candidates, nowMinutes, offsetMinutes = 3) {
  if (!candidates.length) return 0;

  const target = nowMinutes - offsetMinutes;

  let bestIndex = 0;
  let bestDiff = Infinity;

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