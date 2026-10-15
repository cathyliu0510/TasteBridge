# MS2 evaluation evidence

A complete run of the [evaluation package](../../../src/evaluation/) on **synthetic data**. It shows the harness working end to end. These are not Goodreads results: real baseline numbers come from rerunning the same command on preprocessed data.

Run `ms2-synthetic-demo`, Python 3.12.3, 1.8 s. The run used the evaluation code before it was committed. `config.json` therefore shows the parent commit `0e48af9`, so rerun after committing to record the final hash. The command is the container's default, run from a clean `uv sync --frozen --no-dev` environment:

```bash
python -m evaluation.run --synthetic --out results --favorite-counts 1,2,3,4,5 --run-id ms2-synthetic-demo
```

The image was not built while drafting this, because the drafting workspace cannot reach container registries. A Docker run from a fresh clone still needs to be recorded with [`scripts/ms2_fresh_clone_check.sh`](../../../scripts/ms2_fresh_clone_check.sh).

| File | Contents |
| --- | --- |
| [config.json](sample-run/config.json) | arguments, data sha256, split sizes |
| [run.log](sample-run/run.log) | full log |
| [summary.md](sample-run/summary.md) / [summary.csv](sample-run/summary.csv) | every configuration, with 95% intervals |
| [sample_recommendations.json](sample-run/sample_recommendations.json) | three input → output examples |
| [input/](sample-run/input/) | first 200 interactions and 50 books of the synthetic input |

`per_pair.csv` (1.1 MB) is left out; rerunning the command reproduces it exactly.

## Setup

1,000 synthetic users, 600 works, 44,845 interactions. The user split is 800/100/100. All 100 test readers have at least 15 likes, giving 300 pairs: 150 similar and 150 different.

## Results (five favorites each, k = 10)

| Model | Aggregation | Min-Recall@10 | NDCG@10 | Long-tail coverage |
| --- | --- | --- | --- | --- |
| popularity | any | 0.033 ± 0.003 | 0.167 | 0.000 |
| item-kNN | average | **0.064 ± 0.005** | 0.305 | 0.331 |
| item-kNN | least misery | 0.039 ± 0.005 | 0.214 | 0.756 |
| item-kNN | merged seeds | 0.056 ± 0.005 | **0.308** | 0.331 |

Popularity gives the same list under every aggregation because it ignores the readers.

**Different-taste pairs** (item-kNN, Min-Recall@10): average 0.055, merged seeds 0.039, least misery 0.018.

**Fewer favorites** (item-kNN, average): 1 → 0.037, 2 → 0.046, 3 → 0.055, 4 → 0.060, 5 → 0.064.

## What this shows

- **The harness can tell models apart.** On data built with real co-like structure, item-kNN roughly doubles popularity's Min-Recall@10, and the 95% intervals do not overlap. The test suite asserts this.
- **Least misery is the backend's default aggregation, but here it loses on the primary metric.** It is worst on different-taste pairs, where it should help most, and it recommends far more long-tail works. This is synthetic data, so it is not a reason to change the default yet. It is the first comparison to repeat on Goodreads.
- **More favorites help.** Min-Recall rises steadily from one to five favorites, which supports asking for five.
- **A design issue was found and fixed.** With sparse item-kNN neighbourhoods, most works score exactly 0 for one reader, so least-misery ties at 0. Without a tie-break the list falls back to catalogue order. With 20 neighbours, every work in a test pair tied. Ties are now broken by the average score, and a test covers this.

## Before quoting real results

- [ ] Preprocessed `interactions` and `books` match the [input contract](../../../src/evaluation/README.md#input-contract-from-preprocessing).
- [ ] The run uses `--split tune` to choose settings, then `--split test` once.
- [ ] `config.json` records the DVC md5 of the input data.
- [ ] The team's B2 (ALS/BPR) model is added through the `Recommender` interface.
