# scrape_timetable.py
# -*- coding: utf-8 -*-

import csv
import os
import re
import sys
import time
from collections import OrderedDict
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, NavigableString, Tag


# =========================================================
# 設定
# =========================================================
BASE_URL = "https://www.jrkyushu-timetable.jp"

TARGET_DATE = "2026-03-27"
TARGET_YM = "202603"
TARGET_DAY = "27"

# 8時台〜19時台
TARGET_HOURS = set(range(8, 20))

# 取得対象駅
STATION_PAGES = {
    "hakata": {
        "station_name": "博多",
        "code": "28283",
        "url": "https://www.jrkyushu-timetable.jp/cgi-bin/jr-k_time/tt_dep.cgi?c=28283",
    },
    "shingu_chuo": {
        "station_name": "新宮中央",
        "code": "8262",
        "url": "https://www.jrkyushu-timetable.jp/cgi-bin/jr-k_time/tt_dep.cgi?c=8262",
    },
}

# 出力先
OUTPUT_DIR = r"C:\Users\frontier-Python\Desktop\Portfolio\output"
STATIONS_CSV = os.path.join(OUTPUT_DIR, "stations.csv")
TRAINS_CSV = os.path.join(OUTPUT_DIR, "trains.csv")
STOP_TIMES_CSV = os.path.join(OUTPUT_DIR, "stopTimes.csv")

LINE_ID = "kagoshima"
ALLOWED_TRAIN_TYPES = {"普通", "快速", "区間快速"}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/146.0.0.0 Safari/537.36"
    )
}

REQUEST_TIMEOUT = 20
REQUEST_RETRY = 3
SLEEP_SEC = 0.3


# =========================================================
# 共通
# =========================================================
def log(msg: str) -> None:
    print(msg)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def request_html(session: requests.Session, url: str) -> str:
    last_error = None

    for attempt in range(1, REQUEST_RETRY + 1):
        try:
            res = session.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            res.raise_for_status()

            # 念のため raw bytes の長さを確認
            raw_bytes = res.content
            log(f"[DEBUG] status={res.status_code} bytes={len(raw_bytes)} url={url}")

            html = res.content.decode("utf-8", errors="ignore")
            log(f"[DEBUG] text_len={len(html)} url={url}")

            debug_dir = os.path.join(OUTPUT_DIR, "debug_html")
            os.makedirs(debug_dir, exist_ok=True)

            safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', url)[:120]
            debug_path = os.path.join(debug_dir, safe_name + ".html")

            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(html)

            log(f"[DEBUG] saved={debug_path}")

            # 先頭200文字を別ファイルにも保存
            preview_path = os.path.join(debug_dir, safe_name + "_preview.txt")
            with open(preview_path, "w", encoding="utf-8") as f:
                f.write(html[:2000])

            log(f"[DEBUG] preview_saved={preview_path}")

            time.sleep(SLEEP_SEC)
            return html

        except Exception as e:
            last_error = e
            log(f"[WARN] 取得失敗 {attempt}/{REQUEST_RETRY}: {url} -> {e}")
            time.sleep(1.0)

    raise RuntimeError(f"URL取得失敗: {url} / {last_error}")

def load_station_name_to_id(csv_path: str) -> dict[str, str]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"stations.csv が見つかりません: {csv_path}\n"
            "先に output フォルダへ stations.csv を置いてください。"
        )

    mapping = {}

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)

        if not header:
            raise ValueError("stations.csv が空です。")

        for row in reader:
            if len(row) < 2:
                continue
            station_id = row[0].strip()
            station_name = row[1].strip()
            mapping[station_name] = station_id

    return mapping


def build_station_page_url(base_url: str) -> str:
    return f"{base_url}&d={TARGET_DAY}&ym={TARGET_YM}"


def extract_text_lines(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    lines = []
    for s in soup.stripped_strings:
        text = normalize_space(s)
        if text:
            lines.append(text)
    return lines


def is_hour_text(text: str) -> bool:
    return bool(re.fullmatch(r"\d{1,2}", text))


def clean_token(token: str) -> str:
    return normalize_space(token.replace("\xa0", " "))


# =========================================================
# 駅ページから詳細リンク抽出
# =========================================================
def extract_detail_links_from_station_page(html: str) -> list[dict]:
    """
    駅ページを文書順でたどって、
    鹿児島本線（上り/下り）の 8〜19時台に対応する .html リンクを集める。

    戻り値:
    [
      {
        "direction": "上り",
        "hour": 8,
        "minute": "05",
        "detail_url": "https://..."
      },
      ...
    ]
    """
    soup = BeautifulSoup(html, "html.parser")

    results = []

    in_kagoshima_section = False
    current_direction = None
    current_hour = None

    for node in soup.descendants:
        # テキストノード
        if isinstance(node, NavigableString):
            text = clean_token(str(node))
            if not text:
                continue

            # 鹿児島本線の見出し
            if "鹿児島本線" in text and "方面" in text:
                in_kagoshima_section = True
                current_hour = None

                if "（上り）" in text:
                    current_direction = "上り"
                elif "（下り）" in text:
                    current_direction = "下り"
                else:
                    current_direction = None
                continue

            # 他路線に移ったらセクション終了
            if "方面" in text and "鹿児島本線" not in text:
                in_kagoshima_section = False
                current_direction = None
                current_hour = None
                continue

            # 時の見出し
            if in_kagoshima_section and is_hour_text(text):
                current_hour = int(text)
                continue

        # リンク
        elif isinstance(node, Tag) and node.name == "a":
            if not in_kagoshima_section:
                continue
            if current_direction not in {"上り", "下り"}:
                continue
            if current_hour not in TARGET_HOURS:
                continue

            href = (node.get("href") or "").strip()
            label = clean_token(node.get_text())

            # 分のリンクだけ拾う
            if not re.fullmatch(r"\d{1,2}", label):
                continue
            if not href:
                continue
            if ".html" not in href:
                continue

            detail_url = urljoin(BASE_URL, href)

            results.append(
                {
                    "direction": current_direction,
                    "hour": current_hour,
                    "minute": label.zfill(2),
                    "detail_url": detail_url,
                }
            )

    # URL重複除去
    unique = OrderedDict()
    for item in results:
        unique[item["detail_url"]] = item

    return list(unique.values())


# =========================================================
# 詳細ページ解析
# =========================================================
def parse_time_action(token: str):
    """
    例:
    '14:28 着'
    '14:28 発'
    '★14:28 着'
    """
    token = clean_token(token)
    token = re.sub(r"^[★☆◆◇※◎●○△▲□■]+", "", token)
    m = re.match(r"^(\d{2}:\d{2})\s*(着|発)$", token)
    if not m:
        return None
    return m.group(1), m.group(2)


def is_platform_token(token: str) -> bool:
    token = clean_token(token)
    token = token.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    return bool(re.fullmatch(r"\d+", token))


def parse_detail_page(
    html: str,
    direction: str,
    station_name_to_id: dict[str, str],
    detail_url: str,
) -> dict | None:
    """
    詳細ページから trains.csv / stopTimes.csv 用データを作る。
    stations.csv に存在しない駅が1つでも含まれたら、その列車はスキップ。
    """
    lines = extract_text_lines(html)
    text_blob = "\n".join(lines)

    # -----------------------------------------------------
    # 列車種
    # -----------------------------------------------------
    train_type = None

    m = re.search(r"列車種\s*(普通|快速|区間快速)", text_blob)
    if m:
        train_type = m.group(1)

    if not train_type:
        for line in lines:
            line = clean_token(line)
            m = re.match(r"^列車種\s*(普通|快速|区間快速)$", line)
            if m:
                train_type = m.group(1)
                break

    if not train_type or train_type not in ALLOWED_TRAIN_TYPES:
        return None

    # -----------------------------------------------------
    # 列車番号
    # -----------------------------------------------------
    train_id = None

    m = re.search(r"列車番号\s+([0-9A-Za-z]+)", text_blob)
    if m:
        train_id = m.group(1)

    if not train_id:
        for line in lines:
            line = clean_token(line)
            m = re.match(r"^列車番号\s+([0-9A-Za-z]+)", line)
            if m:
                train_id = m.group(1)
                break

    if not train_id:
        raise ValueError(f"列車番号を取得できませんでした: {detail_url}")

    # -----------------------------------------------------
    # 臨時・増発除外
    # -----------------------------------------------------
    if "増発" in text_blob or "臨時" in text_blob:
        log(f"[SKIP] 臨時/増発のため除外: {train_id}")
        return None

    # -----------------------------------------------------
    # 停車駅テーブル開始位置
    # 「駅名 時刻 のりば」に完全一致させない
    # -----------------------------------------------------
    start_idx = None
    for i, line in enumerate(lines):
        if clean_token(line) == "駅名":
            start_idx = i + 1
            break

    if start_idx is None:
        log(f"[WARN] '駅名' が見つからないためスキップ: {train_id}")
        return None

    # 終了位置
    end_idx = len(lines)
    for i in range(start_idx, len(lines)):
        line = clean_token(lines[i])

        if line in {"運転日", "閉じる"}:
            end_idx = i
            break

        if re.match(r"^\d{4}年\s*\d{1,2}月$", line):
            end_idx = i
            break

    stop_lines = [clean_token(x) for x in lines[start_idx:end_idx]]

    # テーブルヘッダの残骸を除去
    stop_lines = [x for x in stop_lines if x not in {"時刻", "のりば", "■"}]

    # -----------------------------------------------------
    # まず「駅名らしいトークン」を全部洗い出す
    # stations.csv にないものが1つでもあれば列車ごとスキップ
    # -----------------------------------------------------
    candidate_station_names = []

    for token in stop_lines:
        if token in {"レ", ""}:
            continue
        if parse_time_action(token):
            continue
        if is_platform_token(token):
            continue

        # 明らかに駅名でない情報は除外
        if token in {"運転日", "列車種", "列車番号"}:
            continue
        if re.match(r"^\d{4}年", token):
            continue

        candidate_station_names.append(token)

    unknown_stations = [x for x in candidate_station_names if x not in station_name_to_id]
    if unknown_stations:
        unknown_stations = list(OrderedDict.fromkeys(unknown_stations))
        log(f"[SKIP] stations.csv にない駅を含むため列車スキップ: {train_id} / {unknown_stations}")
        return None

    # -----------------------------------------------------
    # 停車駅パース
    # -----------------------------------------------------
    stops = []
    i = 0

    while i < len(stop_lines):
        token = stop_lines[i]

        # 駅名トークンだけを起点にする
        if token not in station_name_to_id:
            i += 1
            continue

        station_name = token
        station_id = station_name_to_id[station_name]
        i += 1

        if i >= len(stop_lines):
            break

        # 通過駅
        if stop_lines[i] == "レ":
            i += 1
            continue

        arr_time = ""
        dep_time = ""

        # 1個目の時刻
        first = parse_time_action(stop_lines[i])
        if not first:
            # 想定外の崩れなら次へ
            continue

        t1, act1 = first
        if act1 == "着":
            arr_time = t1
        else:
            dep_time = t1
        i += 1

        # のりばは読み飛ばす
        while i < len(stop_lines) and is_platform_token(stop_lines[i]):
            i += 1

        # 2個目の時刻（中間駅）
        if i < len(stop_lines):
            second = parse_time_action(stop_lines[i])
            if second:
                t2, act2 = second
                if act2 == "着":
                    arr_time = t2
                else:
                    dep_time = t2
                i += 1

                while i < len(stop_lines) and is_platform_token(stop_lines[i]):
                    i += 1

        stops.append(
            {
                "station_name": station_name,
                "station_id": station_id,
                "arr_time": arr_time,
                "dep_time": dep_time,
            }
        )

    if not stops:
        log(f"[WARN] 停車駅が取得できないためスキップ: {train_id}")
        return None

    destination = stops[-1]["station_name"]

    return {
        "train": {
            "train_id": train_id,
            "line_id": LINE_ID,
            "train_type": train_type,
            "destination": destination,
            "direction": direction,
        },
        "stops": stops,
    }


# =========================================================
# CSV出力
# =========================================================
def write_trains_csv(path: str, trains: list[dict]) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["train_id", "line_id", "train_type", "destination", "direction"])

        for row in trains:
            writer.writerow([
                row["train_id"],
                row["line_id"],
                row["train_type"],
                row["destination"],
                row["direction"],
            ])


def write_stop_times_csv(path: str, stop_rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["train_id", "station_id", "dep_time", "arr_time", "stop_order"])

        for row in stop_rows:
            writer.writerow([
                row["train_id"],
                row["station_id"],
                row["dep_time"],
                row["arr_time"],
                row["stop_order"],
            ])


# =========================================================
# メイン
# =========================================================
def main():
    ensure_dir(OUTPUT_DIR)

    station_name_to_id = load_station_name_to_id(STATIONS_CSV)

    session = requests.Session()

    trains_by_id = {}
    stop_times_by_train = {}

    total_detail_count = 0

    log(f"[info] 対象日: {TARGET_DATE}")
    log(f"[info] 対象時間帯: {sorted(TARGET_HOURS)}時台")

    for station_key, station in STATION_PAGES.items():
        station_page_url = build_station_page_url(station["url"])
        log(f"[station] 取得開始: {station['station_name']} {station_page_url}")

        station_html = request_html(session, station_page_url)
        detail_links = extract_detail_links_from_station_page(station_html)

        log(f"[station] 詳細リンク件数: {len(detail_links)}")
        total_detail_count += len(detail_links)

        for idx, item in enumerate(detail_links, start=1):
            direction = item["direction"]
            hour = item["hour"]
            minute = item["minute"]
            detail_url = item["detail_url"]

            log(f"  [detail {idx}/{len(detail_links)}] {station['station_name']} {hour:02d}:{minute} {direction}")

            try:
                detail_html = request_html(session, detail_url)
                parsed = parse_detail_page(
                    detail_html,
                    direction,
                    station_name_to_id,
                    detail_url,
                )
            except Exception as e:
                log(f"  [WARN] 詳細ページ解析失敗: {detail_url} -> {e}")
                continue

            if not parsed:
                continue

            train = parsed["train"]
            train_id = train["train_id"]

            # 同じ列車を別駅から拾うので重複排除
            if train_id in trains_by_id:
                log(f"  [INFO] 重複列車スキップ: {train_id}")
                continue

            trains_by_id[train_id] = train

            stop_rows = []
            for stop_order, stop in enumerate(parsed["stops"]):
                stop_rows.append(
                    {
                        "train_id": train_id,
                        "station_id": stop["station_id"],
                        "dep_time": stop["dep_time"],
                        "arr_time": stop["arr_time"],
                        "stop_order": stop_order,
                    }
                )

            stop_times_by_train[train_id] = stop_rows
            log(f"  [OK] {train_id} / {train['train_type']} / {train['destination']} / {len(stop_rows)}駅")

    # ソート
    trains = sorted(
        trains_by_id.values(),
        key=lambda x: (x["direction"], x["train_type"], x["train_id"]),
    )

    all_stop_rows = []
    for train_id in sorted(stop_times_by_train.keys()):
        all_stop_rows.extend(stop_times_by_train[train_id])

    # 出力
    write_trains_csv(TRAINS_CSV, trains)
    write_stop_times_csv(STOP_TIMES_CSV, all_stop_rows)

    log("-" * 60)
    log(f"[done] 詳細リンク総数: {total_detail_count}")
    log(f"[done] trains.csv 件数: {len(trains)}")
    log(f"[done] stopTimes.csv 件数: {len(all_stop_rows)}")
    log(f"[done] 出力: {TRAINS_CSV}")
    log(f"[done] 出力: {STOP_TIMES_CSV}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"[ERROR] {e}")
        sys.exit(1)