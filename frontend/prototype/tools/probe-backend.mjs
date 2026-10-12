// Explicit local integration probe. Writes one test feedback event only when
// --feedback is supplied; use a temporary FEEDBACK_PATH for review evidence.
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { TasteBridgeClient } from '../src/api/client.mjs';

const args = process.argv.slice(2);
const valueOf = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const baseUrl = valueOf('--base-url') || 'http://127.0.0.1:9000';
const client = new TasteBridgeClient({ baseUrl });
const health = await client.health();
// These IDs belong only to PR #2's sample export, not to the Goodreads dataset.
const a = ['w_1001', 'w_1002', 'w_1003', 'w_1004', 'w_1005'];
const b = ['w_2001', 'w_2002', 'w_2003', 'w_2004', 'w_2005'];
assert.deepEqual(await client.searchBooks(''), []);
const found = await client.searchBooks('Mistborn');
assert(found.some(book => book.id === 'w_1001'));
const seeds = await Promise.all([...a, ...b].map(id => client.book(id)));
const lower = await client.recommend(a, b, 'least-misery');
const average = await client.recommend(a, b, 'average');
for (const shortlist of [lower, average]) {
  assert.equal(shortlist.modelVersion, health.modelVersion);
  assert.equal(shortlist.results.length, 5);
  for (const result of shortlist.results) {
    for (const [reader, favorites] of [['a', a], ['b', b]]) {
      const reason = result.reasons[reader];
      const seed = seeds.find(book => book.id === reason.seedId);
      assert(favorites.includes(seed.id));
      assert(reason.tags.every(tag => seed.tags.includes(tag) && result.book.tags.includes(tag)));
    }
    const expected = shortlist.mode === 'average' ? (result.fitA + result.fitB) / 2 : Math.min(result.fitA, result.fitB);
    assert(Math.abs(result.score - expected) <= .00011);
  }
}
const pointIds = [...lower.galaxy.a, ...lower.galaxy.b, ...lower.galaxy.bridges].map(point => point.id);
assert.equal(pointIds.length, 15);
await assert.rejects(client.recommend([...a.slice(0, 4), 'not-in-this-catalogue'], b), error => error.status === 404 && error.unknownIds.includes('not-in-this-catalogue'));
const feedback = args.includes('--feedback') ? await client.feedback({
  bookId: lower.results[0].book.id, vote: 'would_read', modelVersion: lower.modelVersion
}) : null;
const report = {
  checkedAt: new Date().toISOString(), backendCommit: 'a9f1620dc2ea3070c600f7cca5128805cc8b74a0',
  spec: 'DRAFT v0.3', health, fixtureOnly: true,
  checks: ['empty search', 'title search', '10 book details', '5 least-misery recommendations',
    '5 average recommendations', 'per-reader reason ownership and shared shelves',
    '15 server galaxy points', '404 unknown ID recovery', ...(feedback ? ['explicit anonymous test feedback'] : [])],
  sampleInput: { reader_a: a, reader_b: b, k: 5, aggregation: 'least_misery' },
  sampleOutput: lower, feedback,
  limits: ['Node client integration only; A/B screens are not connected to the API yet.',
    'Sample shelf vectors only; no trained model or evaluation evidence.',
    'Docker daemon unavailable during this review; native uv service tested.']
};
const output = valueOf('--output');
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ modelVersion: health.modelVersion, numBooks: health.numBooks, passed: report.checks.length, feedback: feedback?.ok ?? 'not requested' }));
