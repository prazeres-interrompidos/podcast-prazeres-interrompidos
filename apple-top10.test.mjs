import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source = await readFile(new URL('./apple-top10.js', import.meta.url), 'utf8');
const { lisbonDay, latestCollectionDay, selectRankings } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = new Date('2026-11-19T12:00:00Z');
const observation = {
  apple_id: '1633619845', country: 'pt', category: '1482', chart_type: 'shows',
  source: 'apple_ids', rank: 3, status: 'ranked', quality: 'comprovado_na_lista',
  divergent: false, date: '2026-11-19', observed_at_utc: '2026-11-19T09:13:03Z'
};
function payload(records = [observation], status = 'completed') {
  return { schema_version: 3, apple_id: '1633619845', run: { scope: 'global', status, finished_at_utc: '2026-11-19T09:17:00Z', observations: records } };
}

test('Uses the Lisbon date across summer time and the autumn clock change', () => {
  assert.equal(lisbonDay(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
  assert.equal(lisbonDay(new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  assert.equal(lisbonDay(new Date('2026-10-25T01:30:00Z')), '2026-10-25');
  assert.equal(lisbonDay(new Date('2026-11-19T23:30:00Z')), '2026-11-19');
});

test('Includes category Top 10 and every recorded general-chart position, keeping the daily best', () => {
  const data = payload([
    { ...observation, rank: 8 }, { ...observation, rank: 3 },
    { ...observation, category: '1301', rank: 10 },
    { ...observation, category: '26', rank: 11 },
    { ...observation, country: 'br', rank: 2 },
    { ...observation, country: 'mo', source: 'apple_rss', rank: 1 }
  ]);
  assert.deepEqual(selectRankings(data, now).map(r => [r.country, r.category, r.rank]),
    [['pt', '1482', 3], ['pt', '1301', 10], ['pt', '26', 11], ['br', '1482', 2], ['mo', '1482', 1]]);
});

test('Retains valid results from a partial collection but rejects incomplete or diagnostic rounds', () => {
  assert.equal(selectRankings(payload(undefined, 'partial'), now).length, 1);
  for (const status of ['running', 'error']) assert.deepEqual(selectRankings(payload(undefined, status), now), []);
  const data = payload(); data.run.scope = 'diagnostic';
  assert.deepEqual(selectRankings(data, now), []);
});

test('General-chart positions outside Top 10 remain visible even when neither category is in Top 10', () => {
  for (const rank of [11, 75, 166, 200, 250]) {
    const data = payload([
      { ...observation, category: '1482', rank: 11 },
      { ...observation, category: '1301', rank: 15 },
      { ...observation, category: '26', rank }
    ]);
    assert.deepEqual(selectRankings(data, now).map(r => [r.category, r.rank]), [['26', rank]]);
  }
  for (const change of [{ rank: null, status: 'not_found' }, { rank: '166' }, { rank: 0 }, { rank: 166, divergent: true }]) {
    assert.deepEqual(selectRankings(payload([{ ...observation, category: '26', ...change }]), now), []);
  }
});

test('Uses the latest completed collection date, rejecting undated, inconsistent or future observations', () => {
  for (const change of [
    { date: '2026-11-18' }, { date: '' }, { date: '2026-11-20' },
    { observed_at_utc: '2026-11-18T23:59:00Z' },
    { observed_at_utc: '2026-11-19T13:00:00Z' }, { observed_at_utc: 'invalid' }
  ]) assert.deepEqual(selectRankings(payload([{ ...observation, ...change }]), now), []);
  assert.equal(latestCollectionDay(payload(), new Date('2026-11-20T00:00:00Z')), '2026-11-19');
  assert.equal(selectRankings(payload(), new Date('2026-11-20T00:00:00Z'))[0].date, '2026-11-19');
  const future = payload(); future.run.finished_at_utc = '2026-11-20T09:00:00Z';
  assert.deepEqual(selectRankings(future, now), []);
  const missing = payload(); delete missing.run.finished_at_utc;
  assert.deepEqual(selectRankings(missing, now), []);
});

test('A new collection without eligible results never resurrects an earlier result', () => {
  const data = payload([{ ...observation, rank: 11, date: '2026-11-20', observed_at_utc: '2026-11-20T09:00:00Z' }, observation]);
  data.run.finished_at_utc = '2026-11-20T09:05:00Z';
  assert.deepEqual(selectRankings(data, new Date('2026-11-20T10:00:00Z')), []);
  data.run.observations = [];
  assert.deepEqual(selectRankings(data, new Date('2026-11-20T10:00:00Z')), []);
});

test('Excludes divergent, unverified, malformed and unrelated records', () => {
  for (const change of [
    { divergent: true }, { quality: 'nao_verificavel' }, { status: 'not_found' },
    { source: 'historical' }, { rank: 0 }, { rank: -1 }, { rank: '3' }, { rank: 1.5 },
    { apple_id: 'another-show' }, { chart_type: 'episodes' }, { category: '9999' }, { country: '' }
  ]) assert.deepEqual(selectRankings(payload([{ ...observation, ...change }]), now), []);
  assert.deepEqual(selectRankings(null, now), []);
  assert.deepEqual(selectRankings({ ...payload(), apple_id: 'another-show' }, now), []);
  assert.deepEqual(selectRankings({ ...payload(), schema_version: 99 }, now), []);
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

test('An open page keeps the dated result at midnight and during an outage, then switches to the new day', async () => {
  let clock = new Date('2026-11-19T23:59:00Z');
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.getTime()])); }
    static now() { return clock.getTime(); }
  }
  const element = () => ({ children: [], textContent: '', append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; } });
  const list = element(), title = element(), date = element();
  const section = { hidden: true, querySelector: selector => selector === '[data-top10-list]' ? list : selector === '[data-top10-date]' ? date : title };
  const intervals = new Map(), events = new Map();
  let data = payload(), offline = false;
  const context = {
    document: { hidden: false, createElement: element, querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener: (name, callback) => events.set(name, callback) },
    Intl, Date: ClockDate, AbortController,
    setInterval: (callback, delay) => intervals.set(delay, callback), setTimeout() {}, clearTimeout() {},
    fetch: async () => { if (offline) throw new Error('Offline'); return { ok: true, json: async () => data }; }
  };
  vm.runInNewContext(source.replaceAll('export function ', 'function '), context);
  context.mountTop10(section);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(section.hidden, false);
  assert.equal(title.textContent, 'Hoje na Apple Podcasts');
  clock = new Date('2026-11-20T07:00:00Z');
  intervals.get(30000)();
  assert.equal(section.hidden, false);
  assert.equal(title.textContent, 'Últimos registos na Apple Podcasts');
  assert.equal(date.textContent, 'Registos de 19/11/2026');
  assert.equal(date.dateTime, '2026-11-19');
  offline = true;
  await events.get('online')();
  assert.equal(section.hidden, false);
  assert.equal(list.children.length, 1);
  offline = false;
  clock = new Date('2026-11-20T09:30:00Z');
  data = payload([{ ...observation, date: '2026-11-20', observed_at_utc: '2026-11-20T09:00:00Z', rank: 2 }]);
  data.run.finished_at_utc = '2026-11-20T09:05:00Z';
  await events.get('online')();
  assert.equal(title.textContent, 'Hoje na Apple Podcasts');
  assert.equal(date.textContent, '20/11/2026');
  data.run.observations[0].rank = 11;
  await events.get('online')();
  assert.equal(section.hidden, true);
  assert.equal(list.children.length, 0);
});
