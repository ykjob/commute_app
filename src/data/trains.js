import { fetchCSV } from "./csvUtils";

export async function loadTrains() {
  const rows = await fetchCSV("/data/trains.csv");

  return rows.slice(1).map((row) => ({
    train_id: row[0],
    line_id: row[1],
    train_type: row[2],
    destination: row[3],
    direction: row[4],
  }));
}