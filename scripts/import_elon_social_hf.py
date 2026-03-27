#!/usr/bin/env python3
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "data", "imports", "elon-musk", "social", "hf_datasets.json")
OUTPUT_PATH = os.path.join(ROOT, "data", "imports", "elon-musk", "social", "hf_social_posts.jsonl")

ROWS_API = "https://datasets-server.huggingface.co/rows"
USER_AGENT = "Mozilla/5.0 (compatible; ElonMuskPixel/0.2; +https://localhost)"
PAGE_SIZE = 100


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def build_rows_url(dataset, config="default", split="train", offset=0, length=100):
    query = urllib.parse.urlencode(
        {
            "dataset": dataset,
            "config": config,
            "split": split,
            "offset": offset,
            "length": length
        }
    )
    return f"{ROWS_API}?{query}"


def status_url(tweet_id):
    return f"https://x.com/elonmusk/status/{tweet_id}"


def infer_title(row):
    text = (row.get("text") or "").strip()
    if not text:
        return "Elon Musk social post"
    compact = " ".join(text.split())
    return compact[:200]


def infer_published(row):
    return row.get("date") or row.get("created_at") or row.get("createdAt") or "unknown"


def infer_tweet_id(row):
    for key in ["tweet_id", "id", "status_id", "statusId"]:
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, int):
            return str(value)
        text = str(value).strip()
        if text and text.lower() != "nan":
            return text
    return ""


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def collect_dataset_rows(dataset_cfg):
    dataset = dataset_cfg["dataset"]
    config = dataset_cfg.get("config", "default")
    split = dataset_cfg.get("split", "train")

    first_url = build_rows_url(dataset, config=config, split=split, offset=0, length=PAGE_SIZE)
    first = fetch_json(first_url)
    total = int(first.get("num_rows_total", 0))

    rows = list(first.get("rows", []))
    print(f"[ok] {dataset}: fetched {len(rows)}/{total}")

    offset = PAGE_SIZE
    while offset < total:
        page_url = build_rows_url(dataset, config=config, split=split, offset=offset, length=PAGE_SIZE)
        page = fetch_json(page_url)
        page_rows = page.get("rows", [])
        rows.extend(page_rows)
        offset += PAGE_SIZE
        if offset % 1000 == 0 or offset >= total:
            print(f"[ok] {dataset}: fetched {min(offset, total)}/{total}")

    return rows


def main():
    config = load_config()
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    all_records = []
    seen_urls = set()

    for dataset_cfg in config.get("datasets", []):
        dataset_rows = collect_dataset_rows(dataset_cfg)
        dataset_name = dataset_cfg["dataset"]

        for item in dataset_rows:
            row = item.get("row", {})
            tweet_id = infer_tweet_id(row)
            if not tweet_id:
                continue

            url = status_url(tweet_id)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            all_records.append(
                {
                    "url": url,
                    "title": infer_title(row),
                    "published_at": infer_published(row),
                    "authority": "secondary",
                    "tags": ["social", "x", "twitter-archive", "huggingface", f"dataset:{dataset_name}"],
                    "notes": f"Imported from Hugging Face dataset {dataset_name}",
                    "captured_at": now_iso()
                }
            )

    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        for record in all_records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"[done] social records written: {len(all_records)}")


if __name__ == "__main__":
    main()
