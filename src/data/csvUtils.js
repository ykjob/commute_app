export async function fetchCSV(path) {
  const normalizedPath = path.startsWith("/")
    ? path.slice(1)
    : path;

  const fullPath = `${import.meta.env.BASE_URL}${normalizedPath}`;

  const res = await fetch(fullPath);

  if (!res.ok) {
    throw new Error(`CSVの読み込みに失敗しました: ${fullPath}`);
  }

  const text = await res.text();

  return text
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r/g, "").split(","));
}