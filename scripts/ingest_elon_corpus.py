#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(ROOT, "data", "manifests", "elon-source-surfaces.json")
OUTPUT_DIR = os.path.join(ROOT, "data", "corpus", "elon-musk")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "corpus.json")
SUMMARY_PATH = os.path.join(OUTPUT_DIR, "summary.json")

USER_AGENT = "Mozilla/5.0 (compatible; ElonMuskPixel/0.1; +https://localhost)"
REQUEST_TIMEOUT = 12


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
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


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
    return items


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

    if kind == "sitemap":
        items = flatten_sitemap(surface)
        for item in items:
            url = item.get("loc", "").strip()
            if not url:
                continue
            if maybe_elon_related(url, ""):
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
            if url and maybe_elon_related(url, item.get("title", "")):
                records.append(
                    build_record(
                        url,
                        surface["id"],
                        {
                            "title": item.get("title", ""),
                            "published": item.get("published", ""),
                            "authority": "primary",
                            "tags": surface.get("tags", [])
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
