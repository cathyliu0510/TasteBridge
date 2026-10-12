# Frontend / backend integration check

Checked October 12 against [PR #2](https://github.com/cathyliu0510/TasteBridge/pull/2), commit `a9f1620dc2ea3070c600f7cca5128805cc8b74a0`, SPEC DRAFT v0.3. The core recommendation fields cover the proposed UI. This is a contract check, not a full backend approval or model validation.

## Verified

- Backend: **71 tests passed, 99% line coverage** in the frozen uv environment.
- [API client](../frontend/prototype/src/api/client.mjs): **17 tests passed** for mapping, nullable metadata, incomplete responses, unknown IDs, timeouts, cancellation and feedback errors.
- Native API + client: search, ten book details, both five-book rankings, separate factual reasons, 15 galaxy points, unknown-ID recovery and an explicit test feedback event passed. [Sample input and mapped output](../frontend/prototype/docs/backend-integration/pr2-v0.3-check.json).

The API served **52 curated books and toy shelf vectors**, not a trained model. Feedback went to a temporary local file. Docker was not rerun because the local daemon was unavailable. The A/B screens and public Site still use their existing local demo engine; the new adapter is ready for wiring.

## UI contract

| API | Frontend adapter |
| --- | --- |
| `book.book_id`, `shelves`, `cover_url` | `book.id`, `tags`, `coverUrl` |
| `fit_a`, `fit_b` | `fitA`, `fitB`; preserve scores, do not display probabilities |
| `reasons.reader_a`, `reader_b` | `reasons.a`, `b`; preserve text and author evidence |
| `seed_id`, `seed_title`, `shared_shelves` | `seedId`, `seedTitle`, `tags` |
| `top_shelves.reader_a`, `reader_b` | `topShelves.a`, `b` |
| `position`, `galaxy` | Preserve the server's coordinates; do not project them again |
| `model_version`, `least_misery` | `modelVersion`, UI mode `least-misery` |

API IDs are opaque. Existing fixture IDs such as `mistborn` are not `w_1001`; use IDs returned by search, without matching titles to invent a mapping. Fetch full details after a search result is selected. Missing year/cover needs a text-only fallback. Blank search returns no results. Handle fewer than five recommendations, including none, before reusing the demo's five-card and sharing helpers. Cancel superseded searches and discard stale recommendation responses after favorites change.

## Decisions still needed

**Feedback:** A records each reader's Interested / Pass / Not sure answer and a reversible joint choice. `/feedback` accepts two joint outcomes in an append-only log. Individual votes cannot be mapped automatically. Proposed boundary: keep them local and send only an explicit joint action; confirm this with Nikhil. The log does not implement choice updates, retries/deduplication or reader-study acceptance rates. The adapter does not automatically retry feedback.

**Models:** §5 currently normalizes book vectors and ranks by cosine to the mean seed vector. Exporting arbitrary vectors does not preserve popularity or item-kNN scoring; even factor models need an agreed scoring rule. Cathy and Nikhil should confirm how baseline scores are served and how map coordinates are supplied. No replacement serving architecture is adopted here. Goodreads `work_id` and API ID format remain modeling decisions. Exposing `data_version` is already a backend MS2 follow-up.

**Layout / submission:** `src/frontend/` is a reasonable proposed location; no folders were moved. Once the reviewed parts are integrated and run together, the team can create `milestone2` from that code. The exact creation/freeze time remains open. [Official MS2 requirements](https://harvard-iacs.github.io/2026-AC215/milestone2/) require that branch and its full commit hash on Canvas by **October 20, 10pm ET**; they do not mandate this folder layout.

## Reproduce the API check

Run PR #2 separately with a temporary `FEEDBACK_PATH`:

```sh
cd src/backend
FEEDBACK_PATH=/tmp/tastebridge-review-feedback.jsonl uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 9000
```

From this PR's `frontend/prototype/`:

```sh
node --test tools/verify-api-client.mjs
node tools/probe-backend.mjs --base-url http://127.0.0.1:9000
```

Add `--feedback` only to deliberately write one anonymous test event. The probe uses PR #2's sample IDs and is not a production dataset test.
