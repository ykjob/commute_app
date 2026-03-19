export async function fetchCSV(path) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${import.meta.env.BASE_URL}${cleanPath}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CSV読み込み失敗: ${url}`);
  }

  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}