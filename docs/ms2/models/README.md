# MS2 baseline models: B0, B1, B2

Owners: **Cathy** (B2 ALS, artifact export), **Anhad** (evaluation harness, B0, B1). Code: [`src/evaluation/evaluation/`](../../../src/evaluation/evaluation/).

## What each model does

| ID | Model | File | Idea | Served by the app? |
|---|---|---|---|---|
| **B0** | Popularity | `models.py` | Rank works by number of likes in training; ignores the readers | No (offline floor) |
| **B1** | Item-kNN | `models.py` | Cosine similarity between works on the user × work like matrix; score = summed similarity to the favorites (top 100 neighbours each) | No (offline) |
| **B2** | Implicit ALS | `als.py` | Learn one vector per reader and per work (Hu, Koren & Volinsky 2008); score = cosine between each work and the reader's taste vector | **Yes**: `export.py` writes the backend's artifact folder |

**Why B2 is the one served.** The backend (`src/backend/app/recommender.py`) ranks with *one vector per book*:
1. Each reader's taste vector is the mean of their favorites' vectors, scaled to length 1.
2. Every book gets a cosine score against each taste vector.
3. The two scores are combined with least-misery or average.

ALS produces exactly those vectors. B0 has no vectors, and B1 has none of a fixed size. `ALS.score()` implements the backend's rule, so the offline numbers describe the lists users actually see.

## Pipeline: train → export → serve

```
data/processed/ ──► make train ──► data/artifacts/b2-als-<data_version>/ ──► make serve / make app
(preprocess)        (ALS on all       books.json, item_embeddings.npy,        backend loads
                     users)            coords_2d.npy (UMAP), meta.json         data/artifacts/current
```

- **Evaluation** (`make evaluate`) fits every model on **training users only** (80/10/10 user split, seed 42) and scores held-out test readers in simulated pairs.
- **Export** (`make train`) refits B2 on **all** users with the same hyperparameters, so the app uses all the data.
- **`coords_2d.npy`:** a 2-D UMAP of the item vectors, scaled to [-1, 1]; this is the taste galaxy. It falls back to PCA if UMAP is unavailable.

## Key hyperparameters (B2)

| Parameter | Value | Meaning |
|---|---|---|
| `factors` | 32 | length of each vector |
| `regularization` | 10.0 | shrinks vectors; protects works with few likes |
| `alpha` | 20.0 | extra confidence on liked (user, work) pairs |
| `iterations` | 15 | alternating solves (readers, then works) |
| `seed` | 42 | random start; the same data gives the same model |
| like threshold | rating ≥ 4 | same as the proposal and B0/B1 |

Each run records these:
- in the evaluation's `results/<run>/config.json` (`arguments.als_*`)
- in the artifact's `meta.json` (`hyperparameters`)

Change them with `--als-factors`, `--als-reg`, `--als-alpha`, `--als-iterations`.

## Model and data versions

- **`model_version`** = `b2-als-<data_version>`, e.g. `b2-als-gr-37c641fd8a07`. The backend reports it at `GET /health` and in every `/recommend` response, so each recommendation can be traced to the data that trained it.
- **`data_version`** comes from `data/processed/manifest.json` (preprocess).
- **`code_version`** (git commit) is in `meta.json`.

## Early results (synthetic data, to be replaced by Goodreads)

These numbers come from **invented** Goodreads-shaped data (`synthetic_raw.py`, 600 works, 3,000 readers). They show that the pipeline and the comparison work end to end. They are **not** results about real readers. Rerun with `make sample` / `make pipeline` and paste the Goodreads table here.

Five favorites per reader, k = 10, 300 test pairs (150 similar-taste, 150 different-taste):

| Model | Aggregation | Min-Recall@10 | NDCG@10 | Long-tail coverage |
|---|---|---|---|---|
| B0 popularity | any | 0.131 | 0.295 | 0.000 |
| B1 item-kNN | average | **0.183** | **0.416** | 0.000 |
| B1 item-kNN | least misery | 0.162 | 0.395 | 0.006 |
| B2 ALS | average | 0.152 | 0.384 | 0.002 |
| B2 ALS | least misery | 0.152 | 0.363 | **0.288** |

What we learned:
- **Both personalized models beat popularity** on the primary metric, so the harness can tell models apart.
- **ALS overfits with 64 factors and weak regularization.** On sparse works (half had ≤ 3 likes), Min-Recall@10 fell to about 0. After length-normalization, the noisy vectors of rare works crowd the cosine ranking. That is why the defaults are 32 factors and regularization 10. The real catalogue keeps only the 5,000 most liked works, so it is much denser; tuning on real data comes next.
- **Least misery** recommends far more long-tail books with ALS, at a small cost in recall. This trade-off needs checking on real data before choosing the app's default aggregation.
- **Serving speed:** `/recommend` took about 6 ms with a 4,551-book B2 artifact. The proposal's target is < 0.5 s.

## Next iteration (MS3)

1. **Tune B2 on the tune split** (`--split tune`): grid over `factors` {16, 32, 64} × `regularization` {1, 10, 50} × `alpha` {5, 20, 40}. Report the chosen setting once on `--split test`.
2. **Real-data comparison:** B0–B2 × {average, least misery, merged seeds} × {similar, different pairs} × 1–5 favorites. Use this to pick the API's default aggregation.
3. **Hybrid M1:** add YiTong's description embeddings (`data/embeddings/desc_embeddings.npy`) and shelf features to the ALS work vectors. This should help works with few likes, the exact weakness seen above. Export it in the same artifact format, so the backend needs no change.
4. **Tracking:** log runs to Weights & Biases and run training as a Vertex AI job (proposal MS3).
