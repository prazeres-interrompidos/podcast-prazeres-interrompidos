import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source = await readFile(new URL('./apple-top10.js', import.meta.url), 'utf8');
const { lisbonDay, selectTop10 } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = new Date('2026-11-19T12:00:00Z');
const observation = {
  apple_id: '1633619845', country: 'pt', category: '1482', chart_type: 'shows',
  source: 'apple_ids', rank: 3, status: 'ranked', quality: 'comprovado_na_lista',
  divergent: false, date: '2026-11-19', observed_at_utc: '2026-11-19T09:13:03Z'
};
function payload(records = [observation], status = 'completed') {
  return { schema_version: 3, apple_id: '1633619845', run: { scope: 'global', status, observations: records } };
}

test('Uses the Lisbon date across summer time and the autumn clock change', () => {
  assert.equal(lisbonDay(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
  assert.equal(lisbonDay(new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(lisbonDay(new Date('2026-10-25T01:30:00Z')), '2026-10-25');
  assert.equal(lisbonDay(new Date('2026-11-19T23:30:00Z')), '2026-11-19');
});

test('Includes rank 10, excludes rank 11, and keeps the daily best for each country/category', () => {
  const data = payload([
    { ...observation, rank: 8 }, { ...observation, rank: 3 },
    { ...observation, category: '1301', rank: 10 },
    { ...observation, category: '26', rank: 11 },
    { ...observation, country: 'br', rank: 2 },
    { ...observation, country: 'mo', source: 'apple_rss', rank: 1 }
  ]);
  assert.deepEqual(selectTop10(data, now).map(r => [r.country, r.category, r.rank]),
    [['pt', '1482', 3], ['pt', '1301', 10], ['br', '1482', 2], ['mo', '1482', 1]]);
});

test('Retains valid results from a partial collection but rejects incomplete or diagnostic rounds', () => {
  assert.equal(selectTop10(payload(undefined, 'partial'), now).length, 1);
  for (const status of ['running', 'error']) assert.deepEqual(selectTop10(payload(undefined, status), now), []);
  const data = payload(); data.run.scope = 'diagnostic';
  assert.deepEqual(selectTop10(data, now), []);
});

test('Never labels stale, undated, inconsistent or future observations as today', () => {
  for (const change of [
    { date: '2026-11-18' }, { date: '' }, { date: '2026-11-20' },
    { observed_at_utc: '2026-11-18T23:59:00Z' },
    { observed_at_utc: '2026-11-19T13:00:00Z' }, { observed_at_utc: 'invalid' }
  ]) assert.deepEqual(selectTop10(payload([{ ...observation, ...change }]), now), []);
  assert.deepEqual(selectTop10(payload(), new Date('2026-11-20T00:00:00Z')), []);
});

test('Excludes divergent, unverified, malformed and unrelated records', () => {
  for (const change of [
    { divergent: true }, { quality: 'nao_verificavel' }, { status: 'not_found' },
    { source: 'historical' }, { rank: 0 }, { rank: -1 }, { rank: '3' }, { rank: 1.5 },
    { apple_id: 'another-show' }, { chart_type: 'episodes' }, { category: '9999' }, { country: '' }
  ]) assert.deepEqual(selectTop10(payload([{ ...observation, ...change }]), now), []);
  assert.deepEqual(selectTop10(null, now), []);
  assert.deepEqual(selectTop10({ ...payload(), apple_id: 'another-show' }, now), []);
  assert.deepEqual(selectTop10({ ...payload(), schema_version: 99 }, now), []);
});

test('The app installation page never starts the banner; the installed app and episode homepage do', async () => {
  for (const [app, installed, expected] of [[true, false, 0], [true, true, 1], [false, false, 1]]) {
    let requests = 0;
    const section = {
      hidden: true,
      classList: { contains: () => app },
      querySelector: selector => selector === '[data-top10-list]' ? { replaceChildren() {} } : {}
    };
    const document = {
      hidden: false,
      documentElement: { classList: { contains: () => installed } },
      querySelectorAll: () => [section], addEventListener() {}
    };
    vm.runInNewContext(source.replaceAll('export function ', 'function '), {
      document, window: { addEventListener() {} }, Intl, Date, AbortController,
      setInterval() {}, setTimeout() {}, clearTimeout() {},
      fetch: () => { requests++; return Promise.reject(new Error('Offline')); }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, expected);
    assert.equal(section.hidden, true, 'Offline or installation pages never display a stale badge');
  }
});
