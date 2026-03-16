import { fetchCSV } from "./csvUtils";

export async function loadStations() {
  const rows = await fetchCSV("/data/stations.csv");

  return rows.slice(1).map((row) => ({
    station_id: row[0],
    station_name: row[1],
    line_id: row[2],
    station_order: Number(row[3]),
  }));
}