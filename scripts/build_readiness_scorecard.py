#!/usr/bin/env python3
import json
import os
import urllib.parse
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_PATH = os.path.join(ROOT, "data", "corpus", "elon-musk", "corpus.json")
SUMMARY_PATH = os.path.join(ROOT, "data", "corpus", "elon-musk", "summary.json")
BENCH_PATH = os.path.join(ROOT, "data", "evals", "elon-musk", "decision-benchmarks.json")
MODES_PATH = os.path.join(ROOT, "data", "evals", "elon-musk", "contradiction-modes.json")
REDTEAM_PATH = os.path.join(ROOT, "data", "evals", "elon-musk", "red-team-checklist.json")
WEIGHT_PATH = os.path.join(ROOT, "data", "evals", "elon-musk", "transcript-weighting.json")
OUTPUT_PATH = os.path.join(ROOT, "data", "evals", "elon-musk", "readiness-scorecard.json")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def calc_corpus_score(total_records):
    # Saturates at 25k records.
    return clamp(total_records / 25000.0)


def calc_benchmark_score(cases, target_count):
    count = len(cases)
    return clamp(count / float(max(target_count, 1)))


def calc_mode_score(modes):
    # Full score at 5 or more contradiction modes.
    return clamp(len(modes) / 5.0)


def calc_redteam_score(checks):
    # Full score at 10 checks.
    return clamp(len(checks) / 10.0)


def calc_long_form_score(corpus, weighting):
    weights = weighting["policy"]["weights"]
    min_share = weighting["policy"]["minimum_long_form_share"]

    weighted_total = 0.0
    weighted_long_form = 0.0

    for row in corpus:
        stype = row.get("source_type", "web_page")
        host = urllib.parse.urlparse(row.get("url", "")).netloc.lower()
        tags = set(row.get("tags", []))

        mapped = "search_discovery"
        if stype == "official_page":
            mapped = "official_page"
        elif stype == "talk_or_event_page":
            mapped = "talk_or_event_page"
        elif "transcript" in tags:
            mapped = "transcript_page"
        elif "podcast" in tags:
            mapped = "podcast_page"
        elif host in {"x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"}:
            mapped = "social_post"

        weight = float(weights.get(mapped, 1.0))
        weighted_total += weight
        if mapped in {"talk_or_event_page", "transcript_page", "podcast_page", "official_page"}:
            weighted_long_form += weight

    if weighted_total == 0:
        return 0.0, 0.0, min_share

    share = weighted_long_form / weighted_total
    score = clamp(share / min_share) if min_share > 0 else 1.0
    return share, score, min_share


def main():
    corpus = load_json(CORPUS_PATH)
    summary = load_json(SUMMARY_PATH)
    bench = load_json(BENCH_PATH)
    modes = load_json(MODES_PATH)
    redteam = load_json(REDTEAM_PATH)
    weighting = load_json(WEIGHT_PATH)

    corpus_score = calc_corpus_score(summary["total_records"])
    benchmark_score = calc_benchmark_score(bench["cases"], bench["target_case_count"])
    mode_score = calc_mode_score(modes["modes"])
    redteam_score = calc_redteam_score(redteam["checks"])
    long_form_share, long_form_score, min_share = calc_long_form_score(corpus, weighting)

    weighted = (
        corpus_score * 0.25
        + benchmark_score * 0.25
        + mode_score * 0.15
        + redteam_score * 0.15
        + long_form_score * 0.20
    )
    # Prevent inflated readiness when short-form posts dominate.
    if long_form_score < 0.5:
        weighted = min(weighted, 0.65 * long_form_score + 0.35)

    readiness_percent = round(weighted * 100.0, 1)

    scorecard = {
        "advisor": "elon-musk",
        "generated_at": now_iso(),
        "readiness_score_percent": readiness_percent,
        "readiness_band": (
            "high" if readiness_percent >= 80 else
            "medium" if readiness_percent >= 55 else
            "low"
        ),
        "components": {
            "corpus_depth": {"score": round(corpus_score * 100.0, 1), "records": summary["total_records"]},
            "benchmark_coverage": {"score": round(benchmark_score * 100.0, 1), "cases": len(bench["cases"]), "target": bench["target_case_count"]},
            "contradiction_modes": {"score": round(mode_score * 100.0, 1), "modes": len(modes["modes"])},
            "red_team_depth": {"score": round(redteam_score * 100.0, 1), "checks": len(redteam["checks"])},
            "long_form_reasoning_balance": {
                "score": round(long_form_score * 100.0, 1),
                "weighted_share": round(long_form_share * 100.0, 2),
                "minimum_share_target": round(min_share * 100.0, 2)
            }
        },
        "notes": [
            "This score measures consultant readiness, not identity equivalence.",
            "A high score still requires ongoing red-team and scenario validation before high-stakes decisions."
        ]
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(scorecard, handle, ensure_ascii=False, indent=2)

    print(f"[done] readiness score: {readiness_percent}%")


if __name__ == "__main__":
    main()
