# Advisor Foundry

Advisor Foundry is an open-source framework for building source-grounded strategic advisors inspired by exceptional operators, founders, and technologists.

The first advisor in this repository is **Elon Musk Advisor**: a public-materials-backed strategic advisor that distills recurring patterns in Elon Musk's worldview, company-building style, decision rules, and product logic without pretending to be Elon Musk or claiming endorsement.

## Why This Exists

Most "AI personas" are just shallow style prompts. This project aims to build something more durable:

- Source-backed: every major trait should map to public evidence.
- Structured: worldview, business philosophy, operating cadence, decision heuristics, and blind spots are separated.
- Reusable: the same framework can later support advisors inspired by Jensen Huang, Lisa Su, and others.
- Open-source friendly: GitHub can store metadata, notes, prompts, evaluations, and lawful summaries without becoming a dumping ground for copyrighted books or full transcripts.

## Repository Layout

```text
dreamteam/
├── advisors/
│   ├── _template/
│   └── elon-musk/
├── data/
│   ├── source-registry/
│   ├── corpus/
│   └── imports/
├── scripts/
├── .github/workflows/
├── docs/
└── prompts/
```

## What Is Already Included

- A reusable repository thesis and roadmap
- A first-pass Elon Musk persona specification in Chinese
- A source registry covering high-signal public materials
- An evaluation rubric to keep the advisor honest
- A GitHub-safe ingestion policy
- A system prompt starter for the advisor
- A live ingestion pipeline with corpus output
- Daily GitHub Actions ingestion and auto-commit
- A template for future advisors

## Daily Ingestion

The repository now runs daily ingestion via GitHub Actions:

- Workflow file: `.github/workflows/daily-ingestion.yml`
- Schedule: daily UTC cron
- Action: run social importers, refresh corpus, rebuild readiness score, then auto-commit changes

Manual local run:

```bash
python3 -B scripts/import_elon_social_hf.py
python3 -B scripts/import_elon_social_archives.py
INGEST_SKIP_SURFACES=tesla-youtube-feed,spacex-youtube-feed,search-discovery-layer,lex-transcript-feed python3 -B scripts/ingest_elon_corpus.py
python3 -B scripts/build_readiness_scorecard.py
```

## Importing Social Posts and Podcast Transcripts

Place `.jsonl` files in:

- `data/imports/elon-musk/social/`
- `data/imports/elon-musk/podcasts/`

The ingestion pipeline will automatically include those rows in the corpus.

By default:

- `scripts/import_elon_social_hf.py` imports from Hugging Face dataset configs in `data/imports/elon-musk/social/hf_datasets.json`.
- `scripts/import_elon_social_archives.py` imports from external JSON archive configs in `data/imports/elon-musk/social/external_archives.json`.

Both write normalized rows to `data/imports/elon-musk/social/*.jsonl`, which are picked up by the ingestion pipeline.

## Consultant Readiness

The repository now includes consultant-readiness assets:

- Decision benchmark bank: `data/evals/elon-musk/decision-benchmarks.json` (120 cases)
- Contradiction modes: `data/evals/elon-musk/contradiction-modes.json`
- Red-team checklist: `data/evals/elon-musk/red-team-checklist.json`
- Transcript weighting policy: `data/evals/elon-musk/transcript-weighting.json`
- Score builder: `scripts/build_readiness_scorecard.py`
- Score output: `data/evals/elon-musk/readiness-scorecard.json`

## Operating Principles

1. Do not impersonate.
2. Do not fabricate private intent.
3. Prefer first-party material over commentary.
4. Separate evidence from inference.
5. Keep copyrighted material out of version control unless rights are clear.
6. Preserve contradictions instead of flattening the person into motivational fluff.

## Next Steps

1. Expand the source registry into a machine-ingestible dataset.
2. Add transcript acquisition and chunking workflows for public talks.
3. Build evaluation prompts that compare answers against known Musk patterns.
4. Ship a lightweight demo app and public benchmark to make the repo star-worthy.

See `docs/project-thesis.zh-CN.md`, `advisors/elon-musk/persona-spec.zh-CN.md`, and `advisors/elon-musk/evaluation-rubric.md` to continue.
