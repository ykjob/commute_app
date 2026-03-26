export async function fetchCSV(path) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${import.meta.env.BASE_URL}${cleanPath}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CSV読み込み失敗: ${url}`);
  }

  // CSV文字列を行ごと・セルごとに分割して配列化する
  // 改行コード \r を除去して Windows 環境にも対応する
  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r/g, "").split(",").map((cell) => cell.trim()));
}