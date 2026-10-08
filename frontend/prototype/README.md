# TasteBridge frontend prototype

[Live prototype](https://tastebridge-prototype.landenini.chatgpt.site/) · [Project scope](https://tastebridge-prototype.landenini.chatgpt.site/project/)

A (Reading Desk) is the preferred interface; B (Book Journey) is the comparison. Both demonstrate two readers choosing five favorites each, exploring five new bridge books, inspecting separate reasons, and making a reversible shared choice. Project links carry the selected favorite IDs and ranking mode back to the demo; votes and joint choices remain page-local.

The current demo uses 23 curated sample books and deterministic theme vectors. It has no trained model, remote API, RAG backend, accounts, or synchronized reading rooms.

The project overview follows the final three-page MS1 proposal shared by the team. Data caps, model comparison, reader-study design, performance criteria, and later milestones are labeled as planned work or targets. It omits architecture alternatives, stretch goals, and later meeting suggestions that have not been adopted. Submission or instructor-approval status is not asserted.

## Build and run

Requires Node.js. No package installation is needed.

```sh
node scripts/build-prototype.mjs
node scripts/verify-release.mjs
python3 -m http.server 4175 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4175/ for A, `/b/` for B, and `/project/` for the scope page.

Edit src/a/ and src/b/ for the independent interfaces, and pages/project.html for project content. The build creates self-contained HTML in dist/, embedding the included fonts and original illustrations. Typeface license files are in each version's shared/fonts directory and are preserved in the HTML bundles.

Keep full dataset downloads, credentials, personal information, and private team messages out of this folder. New project directions should be discussed before being represented as adopted plans.

The shared Site is published separately by its owner. Merging this PR does not automatically deploy the Site or change the project scope.

## Validation for release 20261008.1

The four routes passed bundled JavaScript and metadata checks. Browser checks covered desktop/phone layout, milestone expansion, sample recommendations, and restoring favorites after visiting the project page. These checks verify frontend behavior; they do not measure recommendation quality or model performance.
