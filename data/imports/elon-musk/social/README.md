# Social Import Format

Drop one or more `.jsonl` files in this folder.

Each line should be a JSON object:

```json
{"url":"https://x.com/elonmusk/status/123","title":"Post title or first line","published_at":"2025-01-01T00:00:00Z","authority":"primary","tags":["social","x"],"notes":"optional context"}
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
