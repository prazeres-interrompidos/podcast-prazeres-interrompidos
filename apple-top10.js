// Shared by the episode homepage and the official app. No chart lists are stored.
const FEED_URL = 'https://raw.githubusercontent.com/prazeres-interrompidos/top-apple-podcasts-prazeres-interrompidos/main/public/latest.json';
const CATEGORIES = new Map([['1482', 'Livros'], ['1301', 'Arte'], ['26', 'Top Geral de Programas']]);
const categoryOrder = ['1482', '1301', '26'];
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' });

export function lisbonDay(date = new Date()) {
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function latestCollectionDay(data, now = new Date()) {
  const run = data?.run;
  if (data?.schema_version !== 3 || String(data?.apple_id) !== '1633619845' ||
      run?.scope !== 'global' || !['completed', 'partial'].includes(run.status) || !Array.isArray(run.observations)) return '';
  const completed = new Date(run.finished_at_utc);
  if (!Number.isFinite(completed.getTime()) || completed > now) return '';
  return lisbonDay(completed);
}

export function selectRankings(data, now = new Date()) {
  const day = latestCollectionDay(data, now);
  if (!day) return [];
  const best = new Map();
  for (const record of data.run.observations) {
    if (!record || String(record.apple_id) !== '1633619845' || record.chart_type !== 'shows' ||
        record.date !== day || record.status !== 'ranked' || record.quality !== 'comprovado_na_lista' ||
        record.divergent !== false || !['apple_ids', 'apple_rss'].includes(record.source) ||
        !Number.isInteger(record.rank) || record.rank < 1 ||
        !CATEGORIES.has(record.category) || !/^[a-z]{2}$/.test(record.country)) continue;
    const observed = new Date(record.observed_at_utc);
    if (!Number.isFinite(observed.getTime()) || observed > now || lisbonDay(observed) !== day) continue;
    const key = `${record.country}:${record.category}`;
    if (!best.has(key) || record.rank < best.get(key).rank) best.set(key, record);
  }
  return [...best.values()].sort((a, b) =>
    Number(b.country === 'pt') - Number(a.country === 'pt') ||
    a.country.localeCompare(b.country) || categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
}

export function mountTop10(section) {
  const list = section.querySelector('[data-top10-list]');
  const dateLabel = section.querySelector('[data-top10-date]');
  const title = section.querySelector('.apple-top10__title');
  let shownDay = '';
  let signature = '';
  let loading = false;
  let countryNames;
  try { countryNames = new Intl.DisplayNames(['pt-PT'], { type: 'region' }); } catch (_) { /* Country code is the fallback. */ }

  function hide() {
    section.hidden = true;
    list.replaceChildren();
    signature = '';
    shownDay = '';
  }

  function updateContext() {
    if (!shownDay) return;
    const today = shownDay === lisbonDay();
    title.textContent = today ? 'Hoje na Apple Podcasts' : 'Últimos registos na Apple Podcasts';
    const [year, month, date] = shownDay.split('-');
    dateLabel.textContent = `${today ? '' : 'Registos de '}${date}/${month}/${year}`;
    dateLabel.dateTime = shownDay;
  }

  async function refresh() {
    updateContext();
    if (loading) return;
    loading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${FEED_URL}?v=${Math.floor(Date.now() / 300000)}`, {
        cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
      });
      if (!response.ok) throw new Error('Rankings unavailable');
      const records = selectRankings(await response.json());
      if (!records.length) { hide(); return; }
      const nextSignature = JSON.stringify(records.map(r => [r.date, r.country, r.category, r.rank]));
      if (signature !== nextSignature) {
        const cards = records.map(record => {
          const item = document.createElement('li');
          item.className = 'apple-top10__item';
          const position = document.createElement('strong');
          position.className = 'apple-top10__rank';
          position.textContent = `${record.rank}.º`;
          const detail = document.createElement('span');
          const category = document.createElement('b');
          category.textContent = CATEGORIES.get(record.category);
          const country = document.createElement('span');
          country.className = 'apple-top10__country';
          country.textContent = countryNames?.of(record.country.toUpperCase()) || record.country.toUpperCase();
          detail.append(category, country);
          item.append(position, detail);
          return item;
        });
        list.replaceChildren(...cards);
        signature = nextSignature;
      }
      shownDay = records[0].date;
      updateContext();
      section.hidden = false;
    } catch (_) {
      // Keep an already verified result during a temporary connection failure.
      updateContext();
    } finally {
      clearTimeout(timeout);
      loading = false;
    }
  }

  // At midnight, relabel the last verified date until the next collection arrives.
  setInterval(updateContext, 30000);
  setInterval(() => { if (!document.hidden) refresh(); }, 300000);
  document.addEventListener('visibilitychange', () => { updateContext(); if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('online', refresh);
  refresh();
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-apple-top10]').forEach(section => {
    if (section.classList.contains('apple-top10--app') && !document.documentElement.classList.contains('standalone-mode')) return;
    mountTop10(section);
  });
}
