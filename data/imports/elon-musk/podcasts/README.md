# Podcast Import Format

Drop one or more `.jsonl` files in this folder.

Each line should be a JSON object:

```json
{"url":"https://lexfridman.com/elon-musk-4-transcript","title":"Lex Fridman Podcast #400 - Elon Musk","published_at":"2024-01-01","authority":"secondary","tags":["podcast","transcript","lex-fridman"],"notes":"public transcript page"}
```

Required fields:

- `url`

Recommended fields:

- `title`
- `published_at`
- `authority`
- `tags`
- `notes`

The ingestion job reads all `.jsonl` files in this directory.
