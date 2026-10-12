# Frontend / backend integration

Version A **20261012.2** connects to [Nikhil's PR #2](https://github.com/cathyliu0510/TasteBridge/pull/2), commit `a9f1620dc2ea3070c600f7cca5128805cc8b74a0`, SPEC v0.3. B remains the independent offline comparison. [MS2 app evidence](ms2/frontend-api/) records the checks and sample input/output.

## What works

- Title/author search, full book details, five favorites per reader, both ranking modes and separate factual reasons.
- Server-provided top shelves and galaxy coordinates. The frontend scales coordinates to the viewport; it does not recompute embeddings, projection or ranking.
- Loading, cancellation of superseded requests, empty searches/shortlists, and retry after an outage. Favorites and the previous successful shortlist are retained on failure.
- Per-reader interest and reversible joint choices stay local. **Send anonymous feedback** explicitly submits a confirmed joint choice with the returned model version. Individual votes are never submitted.

The service currently uses **52 hand-curated books and toy shelf vectors**, not Goodreads training data or a trained model. The app stack works in Docker. Data ingestion, baseline training and evaluation are separate remaining project work.

## Contract mapping

| API | UI |
| --- | --- |
| `book_id`, `shelves`, `cover_url` | Opaque `id`, `tags`, nullable `coverUrl` |
| `fit_a`, `fit_b` | Signed similarity values; no probabilities |
| `reasons.reader_a`, `reader_b` | Separate reasons and references from each reader's own picks |
| `top_shelves`, `galaxy`, `position` | Reader summaries and server coordinates |
| `model_version`, `least_misery` | Feedback provenance and UI mode `least-misery` |

Search summaries are hydrated before selection; missing years/covers get text-only book jackets. API IDs are not translated from fixture titles or slugs. Project navigation preserves the current API selections. Switching to B starts its offline comparison independently.

## Run

With frontend and PR #2's `src/backend/` together:

```sh
docker compose -f compose.integration.yml up --build
```

Use `docker-compose` if the standalone Compose command is installed. Open http://127.0.0.1:4176/ for connected A. `/a/?api=0` remains the standalone demo. Before the PRs are integrated, set `TASTEBRIDGE_BACKEND_DIR` to the backend checkout's `src/backend/` directory.

For native development:

```sh
node frontend/prototype/scripts/dev.mjs --backend path/to/src/backend
```

## Boundaries

Feedback is an append-only event log. Undoing a local choice does not retract an event; uncertain delivery is not automatically retried. It is not a reader-study acceptance-rate instrument. The UI currently submits positive joint feedback only.

The baseline scoring/artifact interface, production model, directory migration and submission branch still require their existing team decisions. This change neither chooses a replacement scoring architecture nor merges either PR. The [earlier adapter-only check](../frontend/prototype/docs/backend-integration/pr2-v0.3-check.json) is retained as a dated historical record.
