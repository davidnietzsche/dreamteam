#!/usr/bin/env python3
import json
import os
import time
import urllib.request
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "data", "imports", "elon-musk", "social", "external_archives.json")
OUTPUT_PATH = os.path.join(ROOT, "data", "imports", "elon-musk", "social", "external_archive_posts.jsonl")

USER_AGENT = "Mozilla/5.0 (compatible; ElonMuskPixel/0.2; +https://localhost)"
REQUEST_TIMEOUT = 30
RETRY_ATTEMPTS = 3


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def fetch_json(url):
    last_error = None
    for attempt in range(RETRY_ATTEMPTS):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8", errors="replace"))
        except Exception as exc:
            last_error = exc
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(2 ** attempt)
    raise last_error


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def to_record(item, archive_name):
    url = (item.get("url") or "").strip()
    if not url:
        tweet_id = str(item.get("id", "")).strip()
        if tweet_id:
            url = f"https://x.com/elonmusk/status/{tweet_id}"
    if not url:
        return None

    title = " ".join((item.get("text") or "").split()).strip()
    if not title:
        title = "Elon Musk social post"
    title = title[:200]

    created_at = item.get("created_at") or item.get("date") or "unknown"

    return {
        "url": url,
        "title": title,
        "published_at": created_at,
        "authority": "secondary",
        "tags": ["social", "x", "twitter-archive", "external-archive", f"archive:{archive_name}"],
        "notes": f"Imported from external social archive {archive_name}",
        "captured_at": now_iso()
    }


def main():
    cfg = load_config()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    seen = set()
    records = []

    for source in cfg.get("sources", []):
        name = source["name"]
        url = source["url"]
        data = fetch_json(url)
        if not isinstance(data, list):
            print(f"[warn] {name}: expected list, got {type(data).__name__}")
            continue

        added = 0
        for item in data:
            if not isinstance(item, dict):
                continue
            record = to_record(item, name)
            if not record:
                continue
            key = record["url"]
            if key in seen:
                continue
            seen.add(key)
            records.append(record)
            added += 1

        print(f"[ok] {name}: imported {added}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        for row in records:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"[done] archive social records written: {len(records)}")


if __name__ == "__main__":
    main()
