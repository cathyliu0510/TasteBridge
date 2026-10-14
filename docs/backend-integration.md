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

Prerequisites: Git and a running Docker installation with Compose. The containers supply Node and Python; neither is needed on the host for this route.

### Review the two PRs before merging

Clone their branches into sibling directories from a folder of your choice:

```sh
git clone --branch prototype/ms1-scope-and-website --single-branch https://github.com/cathyliu0510/TasteBridge.git TasteBridge-frontend
git clone --branch feature/backend --single-branch https://github.com/cathyliu0510/TasteBridge.git TasteBridge-backend
cd TasteBridge-frontend
TASTEBRIDGE_BACKEND_DIR=../TasteBridge-backend/src/backend docker compose -f compose.integration.yml up --build --wait
```

If your installation uses the standalone `docker-compose` command, substitute it for `docker compose`. Open **http://127.0.0.1:4176/a/?api=1**. The relative backend path is resolved from the frontend repository root. This runs both PRs together without merging either one.

If port 4176 is already in use, add `TASTEBRIDGE_UI_PORT=4186` before the command and open that port. Use `-p tastebridge-review-check` after `docker compose` to isolate an additional review stack from an existing preview.

The checked integration code is frontend `45ec77561a6e8edeea7443e412426b883ffb051c` and backend `a9f1620dc2ea3070c600f7cca5128805cc8b74a0`. The branch tips may include later changes. Record the versions you actually review:

```sh
git rev-parse HEAD
git -C ../TasteBridge-backend rev-parse HEAD
docker compose -f compose.integration.yml ps
```

Both services should be healthy. At the checked version, http://127.0.0.1:4176/api/health reports `sample-shelf-toy-v1` and `num_books: 52`.

Stop this stack from the same directory with the same project name if one was used:

```sh
TASTEBRIDGE_BACKEND_DIR=../TasteBridge-backend/src/backend docker compose -f compose.integration.yml down
```

`down` preserves the feedback volume. There is no need to submit feedback to check the rest of the app.

### After the two sources are integrated

With the backend present at `src/backend/`, the path override is unnecessary:

```sh
docker compose -f compose.integration.yml up --build --wait
```

PR #2's plain `docker compose up --build` starts its backend only. Use the integration file above for the connected UI. `/a/?api=0` remains the standalone demo.

For native development, install Node and `uv`, then use:

```sh
node frontend/prototype/scripts/dev.mjs --backend path/to/src/backend
```

## Review checklist

1. Search and select five favorites per reader, or use **Try a sample pair**. Confirm five recommendations with separate reasons for each reader.
2. Change **Rank by** between **Lower reader match** (least-misery) and **Average reader match**. Open a galaxy point and book details; confirm the shortlist and explanations update.
3. Check local **Interested / Pass / Not sure**, shared choice and undo. Feedback is sent only with **Send anonymous feedback**; do not submit an event unless you intend to test that action.
4. Inspect the [recorded outage, empty-state and phone checks](ms2/frontend-api/). Open `/a/?api=0` to compare the independent demo; the public hosted URL does not exercise this local API.

For a review comment, include both commit hashes, the flow checked and any expected/actual mismatch. UI/integration findings belong with [PR #1](https://github.com/cathyliu0510/TasteBridge/pull/1); API/artifact-contract findings belong with [PR #2](https://github.com/cathyliu0510/TasteBridge/pull/2). Local tests and runtime evidence do not constitute a teammate approval or a GitHub CI check.

## MS2 coverage

This app stack covers the basic UI/backend interaction and containerized application evidence. The [official MS2 requirements](https://harvard-iacs.github.io/2026-AC215/milestone2/) also require a single command for the complete pipeline, basic data-version records and applicable data/model steps, with logs and example inputs/outputs. For this recommendation project, real ingestion/preprocessing and baseline results still need to be checked separately.

Submit the `milestone2` branch's full commit hash on Canvas by **October 20, 10pm ET**. Reviewing these PRs does not itself submit the milestone. Local environment screenshots are acceptable; a public API deployment is not a listed prerequisite.

The backend has `pyproject.toml` and `uv.lock`. The frontend uses Node's built-in modules and needs no package installation. The course page's wording about `uv`/`pyproject.toml` for each container needs clarification for non-Python components.

## Boundaries

Feedback is an append-only event log. Undoing a local choice does not retract an event; uncertain delivery is not automatically retried. It is not a reader-study acceptance-rate instrument. The UI currently submits positive joint feedback only.

The baseline scoring/artifact interface, production model, directory migration and submission branch still require their existing team decisions. This change neither chooses a replacement scoring architecture nor merges either PR. The [earlier adapter-only check](../frontend/prototype/docs/backend-integration/pr2-v0.3-check.json) is retained as a dated historical record.
