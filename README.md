# TasteBridge

A book recommender for two readers. Each picks five favorites; TasteBridge suggests five shared reads with a reason for each person.

[Frontend prototype](https://tastebridge-prototype.landenini.chatgpt.site/) · [MS1 project scope](https://tastebridge-prototype.landenini.chatgpt.site/project/)

The frontend demo uses 23 curated sample books. The data pipeline, trained recommender and backend are planned in the MS1 proposal.

## Dataset

[UCSD Goodreads Book Graph](https://cseweb.ucsd.edu/~jmcauley/datasets/goodreads.html), collected from public shelves in late 2017. Academic use only; do not redistribute dataset files or use them commercially.

| Subset | Books | Interactions | Downloads |
| --- | ---: | ---: | --- |
| Fantasy & Paranormal | 258,585 | 55,397,550 | [Metadata](https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads/byGenre/goodreads_books_fantasy_paranormal.json.gz) · [Interactions](https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads/byGenre/goodreads_interactions_fantasy_paranormal.json.gz) |
| Mystery, Thriller & Crime | 219,235 | 24,799,896 | [Metadata](https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads/byGenre/goodreads_books_mystery_thriller_crime.json.gz) · [Interactions](https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads/byGenre/goodreads_interactions_mystery_thriller_crime.json.gz) |

These are gzip-compressed JSON files. Counts are before filtering; the genres overlap.

The MVP is capped at **5,000 distinct works** and **500,000 training interactions**. Join records on `book_id`, remove cross-genre duplicates, and group editions by `work_id` before evaluation. Interactions provide `user_id`, `book_id`, `rating` and `is_read`; metadata provides titles, authors, descriptions and shelf tags.

## Model and evaluation plan

- **Models:** popularity, item-kNN and ALS/BPR baselines, compared with a hybrid of interaction factors and book metadata.
- **Pair ranking:** compare average and least-misery aggregation. The 2D map uses model representations; reasons use retrieved metadata facts.
- **Evaluation:** simulated pairs with an 80/10/10 user split; primary Min-Recall@10 (the lower reader recall), plus mean NDCG@10 and long-tail coverage. A planned study with 12–20 volunteer pairs checks joint acceptance, decision time and explanation usefulness.

## Milestone 2

The proposal calls for a one-command Docker pipeline, a work-level dataset tracked with DVC, baseline results and run logs, and an app skeleton.

## Frontend

Editable A/B source, standalone HTML and [build/run instructions](frontend/prototype/README.md#build-and-run) are in [frontend/prototype](frontend/prototype/).
