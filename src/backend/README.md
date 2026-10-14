# TasteBridge API service

FastAPI service that returns "bridge books" for two readers. It serves a model
exported by the modeling pipeline. It never trains one. The full contract is in
[SPEC.md](SPEC.md).

## Run it

**With Docker (one command, from the repo root):**

```bash
docker compose up --build
```

If `docker compose` isn't recognized, use `docker-compose` (the standalone binary) in place of `docker compose` in every command below, or install the Compose plugin.

Stop it:

```bash
docker compose down
```

Feedback votes persist in the named volume `feedback`; to wipe them:

```bash
docker compose down -v
```

**Locally with uv (from `src/backend/`):**

```bash
uv sync                                          # create .venv from uv.lock
uv run uvicorn app.main:app --reload --port 9000
```

Open http://localhost:9000/docs for interactive API docs.

## Try it

```bash
curl http://localhost:9000/health
curl "http://localhost:9000/books/search?q=mist"
curl http://localhost:9000/books/w_1001
curl -X POST http://localhost:9000/recommend -H "Content-Type: application/json" \
  -d '{"reader_a":["w_1001","w_1002","w_1003","w_1004","w_1005"],
       "reader_b":["w_2001","w_2002","w_2003","w_2004","w_2005"]}'
curl -X POST http://localhost:9000/feedback -H "Content-Type: application/json" \
  -d '{"book_id":"w_3002","vote":"would_read","model_version":"sample-shelf-toy-v1"}'
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service status and loaded model version |
| GET | `/books/search?q=&limit=` | Title/author search for the picker |
| GET | `/books/{book_id}` | One book's details |
| POST | `/recommend` | Ranked bridge books, reasons and galaxy coordinates |
| POST | `/feedback` | Anonymous "would read / not for us" vote |

## Configuration

Settings are read from environment variables. See [.env.example](.env.example).

| Variable | Default | Meaning |
|---|---|---|
| `ARTIFACT_DIR` | `sample_artifacts/` | Model artifact folder (SPEC.md §5) |
| `FEEDBACK_PATH` | `feedback/feedback.jsonl` | Where votes are appended |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `PORT` | `9000` | Container port (Cloud Run sets this) |

The server refuses to start if the artifact folder is missing files or the row
counts don't match.

## Sample artifacts

`sample_artifacts/` holds 52 hand-picked books (IDs `w_1xxx` fantasy, `w_2xxx`
mystery, `w_3xxx` in between). The embeddings are **toy** vectors built from
shelf tags. They are not a trained model. To regenerate them after editing
`books.json`:

```bash
uv run python scripts/make_sample_artifacts.py
```

## Tests

```bash
uv run pytest --cov --cov-report=term-missing
```

## Layout

```
app/
  main.py               app factory, startup loading, CORS, request logging
  config.py             environment settings
  artifacts.py          load + validate the model artifact folder
  schemas.py            Pydantic request/response models (the JSON contract)
  search.py             catalogue search
  recommender.py        taste vectors, fit scores, aggregation, top-k
  explanations.py       metadata-only reason text
  recommend_service.py  assembles the /recommend response
  feedback.py           JSON-lines vote store
  routers/              one thin module per endpoint group
sample_artifacts/       toy artifact set for development
scripts/                sample-artifact generator
tests/                  pytest suite
```
