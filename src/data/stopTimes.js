import { fetchCSV } from "./csvUtils";

export async function loadStopTimes() {
  const rows = await fetchCSV("/data/stopTimes.csv");

  return rows.slice(1).map((row) => ({
    train_id: row[0],
    station_id: row[1],
    dep_time: row[2] || "",
    arr_time: row[3] || "",
    stop_order: Number(row[4]),
  }));
}