#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "data", "manifests", "elon-source-surfaces.json")
OUTPUT_DIR = os.path.join(ROOT, "data", "corpus", "elon-musk")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "corpus.json")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "summary.json")

USER_AGENT = "Mozilla/5.0 (compatible; ElonMuskPixel/0.1; +https://localhost)"
REQUEST_TIMEOUT = 12
RETRY_ATTEMPTS = 3
SKIP_SURFACES = {
    item.strip()
    for item in os.environ.get("INGEST_SKIP_SURFACES", "").split(",")
    if item.strip()
}


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_title = False
        self.title = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def fetch_text(url):
    last_error = None
    for attempt in range(RETRY_ATTEMPTS):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(charset, errors="replace")
        except Exception as exc:
            last_error = exc
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(2 ** attempt)
    raise last_error


def safe_slug(url):
    parsed = urllib.parse.urlparse(url)
    slug = f"{parsed.netloc}{parsed.path}".strip("/")
    slug = slug or parsed.netloc
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", slug).strip("-").lower()
    return slug[:120]


def detect_domain_group(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    for key in ["tesla.com", "spacex.com", "x.ai", "ted.com", "youtube.com", "google.com", "simonandschuster.com"]:
        if key in host:
            return key
    return host


def guess_source_type(url):
    host = urllib.parse.urlparse(url).netloc.lower()
    if "youtube.com" in host:
        return "video_feed_item"
    if "ted.com" in host:
        return "talk_or_event_page"
    if "tesla.com" in host or "spacex.com" in host or "x.ai" in host:
        return "official_page"
    return "web_page"


def parse_title(html):
    parser = TitleParser()
    parser.feed(html)
    title = " ".join(piece.strip() for piece in parser.title if piece.strip())
    return re.sub(r"\s+", " ", title).strip()


def maybe_elon_related(url, title):
    haystack = f"{url} {title}".lower()
    keywords = [
        "elon",
        "musk",
        "tesla",
        "spacex",
        "starship",
        "starlink",
        "xai",
        "twitter",
        "neuralink",
        "boring"
    ]
    return any(keyword in haystack for keyword in keywords)


def extract_urls_from_sitemap(xml_text):
    root = ET.fromstring(xml_text)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tag = root.tag.lower()

    if tag.endswith("sitemapindex"):
        nested = []
        for item in root.findall("sm:sitemap", ns):
            loc = item.findtext("sm:loc", default="", namespaces=ns).strip()
            if loc:
                nested.append(loc)
        return {"kind": "index", "urls": nested}

    urls = []
    for item in root.findall("sm:url", ns):
        loc = item.findtext("sm:loc", default="", namespaces=ns).strip()
        lastmod = item.findtext("sm:lastmod", default="", namespaces=ns).strip()
        if loc:
            urls.append({"loc": loc, "lastmod": lastmod})
    return {"kind": "urlset", "urls": urls}


def flatten_sitemap(surface, limit_nested=8, limit_urls=250):
    xml_text = fetch_text(surface["url"])
    first_pass = extract_urls_from_sitemap(xml_text)
    results = []

    if first_pass["kind"] == "urlset":
        return first_pass["urls"][:limit_urls]

    for nested_url in first_pass["urls"][:limit_nested]:
        try:
            nested_text = fetch_text(nested_url)
            nested = extract_urls_from_sitemap(nested_text)
            if nested["kind"] == "urlset":
                results.extend(nested["urls"])
        except Exception:
            continue
        if len(results) >= limit_urls:
            break

    return results[:limit_urls]


def extract_rss_items(xml_text):
    root = ET.fromstring(xml_text)
    items = []
    if root.tag.endswith("feed"):
        for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
            link = ""
            for link_node in entry.findall("{http://www.w3.org/2005/Atom}link"):
                href = link_node.attrib.get("href", "").strip()
                if href:
                    link = href
                    break
            items.append(
                {
                    "loc": link,
                    "title": entry.findtext("{http://www.w3.org/2005/Atom}title", default="").strip(),
                    "published": entry.findtext("{http://www.w3.org/2005/Atom}published", default="").strip()
                }
            )
    elif root.tag.lower().endswith("rss"):
        channel = root.find("channel")
        if channel is not None:
            for item in channel.findall("item"):
                items.append(
                    {
                        "loc": (item.findtext("link", default="") or "").strip(),
                        "title": (item.findtext("title", default="") or "").strip(),
                        "published": (item.findtext("pubDate", default="") or "").strip(),
                        "description": (item.findtext("description", default="") or "").strip()
                    }
                )
    return items


def extract_urls_from_text(text):
    pattern = re.compile(r"https?://[^\s<>\"]+")
    urls = []
    for match in pattern.findall(text):
        cleaned = match.rstrip(".,);")
        urls.append(cleaned)
    return urls


def load_jsonl_records(file_path):
    records = []
    with open(file_path, "r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"[warn] invalid jsonl at {file_path}:{index}", file=sys.stderr)
    return records


def build_record(url, surface_id, extra=None):
    extra = extra or {}
    title = extra.get("title", "") or url

    return {
        "id": safe_slug(url),
        "url": url,
        "title": title,
        "surface_id": surface_id,
        "domain_group": detect_domain_group(url),
        "source_type": guess_source_type(url),
        "published_at": extra.get("published", "") or extra.get("lastmod", "") or "unknown",
        "authority": extra.get("authority", "primary"),
        "tags": extra.get("tags", []),
        "notes": extra.get("notes", ""),
        "captured_at": now_iso()
    }


def ingest_surface(surface):
    kind = surface["kind"]
    records = []
    strict_filter = bool(surface.get("strict_filter", False))

    if kind == "sitemap":
        items = flatten_sitemap(surface)
        for item in items:
            url = item.get("loc", "").strip()
            if not url:
                continue
            if (not strict_filter) or maybe_elon_related(url, ""):
                records.append(
                    build_record(
                        url,
                        surface["id"],
                        {
                            "lastmod": item.get("lastmod", ""),
                            "authority": "primary",
                            "tags": surface.get("tags", [])
                        }
                    )
                )

    elif kind == "rss":
        xml_text = fetch_text(surface["url"])
        items = extract_rss_items(xml_text)
        for item in items:
            url = item.get("loc", "").strip()
            if not url:
                continue
            if (not strict_filter) or maybe_elon_related(url, f"{item.get('title', '')} {item.get('description', '')}"):
                records.append(
                    build_record(
                        url,
                        surface["id"],
                        {
                            "title": item.get("title", ""),
                            "published": item.get("published", ""),
                            "authority": surface.get("authority", "primary"),
                            "tags": surface.get("tags", [])
                        }
                    )
                )

    elif kind == "search_rss":
        for query in surface.get("queries", []):
            encoded = urllib.parse.quote_plus(query)
            feed_url = surface["url_template"].replace("{query}", encoded)
            xml_text = fetch_text(feed_url)
            items = extract_rss_items(xml_text)

            for item in items:
                # Bing RSS item links often point to bing redirect pages.
                discovered_urls = extract_urls_from_text(
                    " ".join(
                        [
                            item.get("loc", ""),
                            item.get("description", ""),
                            item.get("title", "")
                        ]
                    )
                )
                if not discovered_urls and item.get("loc"):
                    discovered_urls = [item["loc"]]

                for discovered in discovered_urls:
                    if "bing.com" in urllib.parse.urlparse(discovered).netloc.lower():
                        continue
                    if strict_filter and not maybe_elon_related(discovered, item.get("title", "")):
                        continue
                    records.append(
                        build_record(
                            discovered,
                            surface["id"],
                            {
                                "title": item.get("title", "") or discovered,
                                "published": item.get("published", ""),
                                "authority": surface.get("authority", "secondary"),
                                "tags": surface.get("tags", []) + [f"query:{query}"]
                            }
                        )
                    )

    elif kind == "manual_list":
        for url in surface.get("urls", []):
            records.append(
                build_record(
                    url,
                    surface["id"],
                    {
                        "authority": "secondary" if "secondary" in surface.get("tags", []) else "primary",
                        "tags": surface.get("tags", [])
                    }
                )
            )

    elif kind == "import_slot":
        records.append(
            {
                "id": surface["id"],
                "url": "",
                "title": surface["label"],
                "surface_id": surface["id"],
                "domain_group": "import-slot",
                "source_type": "import_slot",
                "published_at": "n/a",
                "authority": "mixed",
                "tags": surface.get("tags", []),
                "notes": surface.get("notes", ""),
                "captured_at": now_iso()
            }
        )

    elif kind == "jsonl_import":
        import_dir = Path(ROOT) / surface["path"]
        import_dir.mkdir(parents=True, exist_ok=True)
        files = sorted(import_dir.glob("*.jsonl"))
        for file_path in files:
            imported = load_jsonl_records(str(file_path))
            for item in imported:
                url = (item.get("url") or "").strip()
                if not url:
                    continue
                records.append(
                    build_record(
                        url,
                        surface["id"],
                        {
                            "title": item.get("title", "") or url,
                            "published": item.get("published_at", ""),
                            "authority": item.get("authority", surface.get("authority", "secondary")),
                            "tags": list(set(surface.get("tags", []) + item.get("tags", []))),
                            "notes": item.get("notes", "")
                        }
                    )
                )

    return records


def dedupe_records(records):
    seen = set()
    deduped = []
    for record in records:
        key = record.get("url") or record.get("id")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(record)
    return deduped


def summarize(records):
    counter = Counter(record["domain_group"] for record in records)
    authorities = Counter(record["authority"] for record in records)
    types = Counter(record["source_type"] for record in records)
    return {
        "advisor": "elon-musk",
        "generated_at": now_iso(),
        "total_records": len(records),
        "by_domain_group": dict(counter),
        "by_authority": dict(authorities),
        "by_source_type": dict(types)
    }


def main():
    ensure_output_dir()
    with open(MANIFEST_PATH, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    all_records = []
    failures = []

    for surface in manifest["surfaces"]:
        if surface["id"] in SKIP_SURFACES:
            print(f"[skip] {surface['id']}: configured skip")
            continue
        try:
            records = ingest_surface(surface)
            all_records.extend(records)
            print(f"[ok] {surface['id']}: {len(records)} records")
        except Exception as exc:
            failures.append({"surface_id": surface["id"], "error": str(exc)})
            print(f"[fail] {surface['id']}: {exc}", file=sys.stderr)

    records = dedupe_records(all_records)
    summary = summarize(records)
    summary["failures"] = failures

    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(records, handle, ensure_ascii=False, indent=2)

    with open(SUMMARY_PATH, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    print(f"[done] corpus records: {summary['total_records']}")


if __name__ == "__main__":
    main()
