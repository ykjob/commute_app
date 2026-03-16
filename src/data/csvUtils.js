export async function fetchCSV(filePath) {
  const response = await fetch(filePath);

  if (!response.ok) {
    throw new Error(`CSVの読み込みに失敗しました: ${filePath}`);
  }

  const text = await response.text();

  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}