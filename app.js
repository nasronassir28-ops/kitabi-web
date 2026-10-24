const GUTENDEX = 'https://gutendex.com/books/';
const ARCHIVE = 'https://archive.org/advancedsearch.php';
const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const ROWS = 20;
const SUGGESTIONS = ['المتنبي', 'ابن خلدون', 'الجاحظ', 'ألف ليلة وليلة', 'Shakespeare', 'Dickens', 'Jane Austen', 'Tolstoy'];

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const moreBtn = document.getElementById('more');
const titleEl = document.getElementById('sectionTitle');
const input = document.getElementById('q');
const legal = document.getElementById('legal');

let lang = '';
let query = '';
let srcs = [];
let busy = false;

function isArabicQuery() {
  return /[\u0600-\u06FF]/.test(query);
}

function planSources() {
  const ar = lang === 'ar' || isArabicQuery();
  const list = [];
  if (!ar) list.push('gutendex');
  list.push('google');
  if (ar || query) list.push('archive');
  return list;
}

function gutendexUrl() {
  const p = new URLSearchParams();
  if (query) p.set('search', query);
  if (lang) p.set('languages', lang);
  const qs = p.toString();
  return GUTENDEX + (qs ? '?' + qs : '');
}

function archiveUrl(pg) {
  const clean = query.replace(/["\\]/g, ' ').trim();
  let q = 'mediatype:texts AND language:(ara OR Arabic OR ar) AND NOT collection:(inlibrary OR printdisabled)';
  if (clean) q += ' AND (title:("' + clean + '") OR creator:("' + clean + '"))';
  const p = new URLSearchParams();
  p.set('q', q);
  ['identifier', 'title', 'creator'].forEach(f => p.append('fl[]', f));
  p.append('sort[]', 'downloads desc');
  p.set('rows', String(ROWS));
  p.set('page', String(pg));
  p.set('output', 'json');
  return ARCHIVE + '?' + p.toString();
}

function googleUrl(startIndex) {
  const arabic = lang === 'ar' || isArabicQuery();
  const p = new URLSearchParams();
  p.set('q', query || (arabic ? 'كتب' : 'classic literature'));
  p.set('filter', 'free-ebooks');
  p.set('printType', 'books');
  p.set('maxResults', String(ROWS));
  p.set('startIndex', String(startIndex));
  const lr = lang || (isArabicQuery() ? 'ar' : '');
  if (lr) p.set('langRestrict', lr);
  return GOOGLE + '?' + p.toString();
}

function showStatus(kind, text, retry) {
  statusEl.hidden = false;
  statusEl.replaceChildren();
  if (kind === 'loading') {
    const sp = document.createElement('div');
    sp.className = 'spinner';
    statusEl.append(sp);
  }
  const p = document.createElement('p');
  p.textContent = text;
  statusEl.append(p);
  if (retry) {
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.style.cssText = 'display:inline-block;width:auto;padding:9px 28px;margin-top:12px';
    b.textContent = 'إعادة المحاولة';
    b.onclick = retry;
    statusEl.append(b);
  }
}

function hideStatus() {
  statusEl.hidden = true;
}

function makeCard(o) {
  const card = document.createElement('article');
  card.className = 'card';

  const cv = document.createElement('div');
  cv.className = 'cover';
  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.textContent = o.title;
  cv.append(ph);
  if (o.cover) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = o.cover;
    img.onload = () => ph.remove();
    img.onerror = () => img.remove();
    cv.append(img);
  }
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = o.badge;
  cv.append(badge);

  const info = document.createElement('div');
  info.className = 'info';
  const t = document.createElement('div');
  t.className = 't';
  t.textContent = o.title;
  const a = document.createElement('div');
  a.className = 'a';
  a.textContent = o.author;
  info.append(t, a);

  const act = document.createElement('div');
  act.className = 'actions';
  if (o.url) {
    const link = document.createElement('a');
    link.className = 'btn primary';
    link.href = o.url;
    link.target = '_blank';
    link.rel = 'noopener';
    if (o.download) link.setAttribute('download', '');
    link.textContent = o.label;
    act.append(link);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.type = 'button';
    btn.textContent = 'غير متاح';
    btn.onclick = () => legal.showModal();
    act.append(btn);
  }

  card.append(cv, info, act);
  return card;
}

function gutendexItem(b) {
  let url = null;
  let badge = 'محمي';
  const f = b.formats || {};
  if (b.copyright !== true) {
    if (f['application/epub+zip']) { url = f['application/epub+zip']; badge = 'EPUB'; }
    else if (f['application/pdf']) { url = f['application/pdf']; badge = 'PDF'; }
  }
  return {
    title: b.title || 'بدون عنوان',
    author: (b.authors && b.authors[0] && b.authors[0].name) || 'مؤلف غير معروف',
    cover: f['image/jpeg'],
    badge: badge,
    url: url,
    label: 'تحميل',
    download: true
  };
}

function archiveItem(d) {
  const title = Array.isArray(d.title) ? d.title[0] : d.title;
  const author = Array.isArray(d.creator) ? d.creator[0] : d.creator;
  const id = encodeURIComponent(d.identifier);
  return {
    title: title || 'بدون عنوان',
    author: author || 'مؤلف غير معروف',
    cover: 'https://archive.org/services/img/' + id,
    badge: 'الأرشيف',
    url: 'https://archive.org/details/' + id,
    label: 'عرض وتحميل',
    download: false
  };
}

function googleItem(v) {
  const vi = v.volumeInfo || {};
  const ai = v.accessInfo || {};
  const pdf = ai.pdf && ai.pdf.isAvailable && ai.pdf.downloadLink;
  const epub = ai.epub && ai.epub.isAvailable && ai.epub.downloadLink;
  let url = null;
  let label = 'تحميل';
  let badge = 'محمي';
  if (pdf) { url = pdf; badge = 'PDF'; }
  else if (epub) { url = epub; badge = 'EPUB'; }
  else if (ai.webReaderLink && ai.viewability === 'ALL_PAGES') {
    url = ai.webReaderLink; label = 'قراءة'; badge = 'Google';
  }
  const img = vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail);
  return {
    title: vi.title || 'بدون عنوان',
    author: (vi.authors && vi.authors[0]) || 'مؤلف غير معروف',
    cover: img ? img.replace(/^http:/, 'https:') : null,
    badge: badge,
    url: url,
    label: label,
    download: false
  };
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function fetchSource(s) {
  if (s.id === 'gutendex') {
    const data = await getJson(s.next || gutendexUrl());
    s.next = data.next ? data.next.replace(/^http:/, 'https:') : null;
    return { items: (data.results || []).map(gutendexItem), more: !!s.next };
  }
  if (s.id === 'archive') {
    const data = await getJson(archiveUrl(s.page + 1));
    const docs = (data.response && data.response.docs) || [];
    const total = (data.response && data.response.numFound) || 0;
    return { items: docs.map(archiveItem), more: (s.page + 1) * ROWS < total };
  }
  const data = await getJson(googleUrl(s.page * ROWS));
  const items = data.items || [];
  return { items: items.map(googleItem), more: items.length === ROWS };
}

async function run(append) {
  if (busy) return;
  busy = true;
  moreBtn.hidden = true;
  if (!append) {
    grid.replaceChildren();
    srcs = planSources().map(id => ({ id: id, page: 0, next: null, done: false }));
  }
  showStatus('loading', 'جارٍ التحميل...');
  try {
    const active = srcs.filter(s => !s.done);
    const results = await Promise.allSettled(active.map(fetchSource));
    let failed = 0;
    const lists = results.map((r, i) => {
      const s = active[i];
      if (r.status === 'fulfilled') {
        s.page += 1;
        if (!r.value.more) s.done = true;
        return r.value.items;
      }
      failed += 1;
      return [];
    });
    if (failed === active.length) throw new Error('all failed');
    const max = Math.max(0, ...lists.map(l => l.length));
    for (let i = 0; i < max; i++) {
      lists.forEach(l => { if (l[i]) grid.append(makeCard(l[i])); });
    }
    if (!grid.children.length) {
      showStatus('empty', 'لا توجد نتائج. جرّب كلمة أخرى أو غيّر اللغة.');
    } else {
      hideStatus();
    }
    moreBtn.hidden = srcs.every(s => s.done);
  } catch (e) {
    showStatus('error', 'تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.', () => run(append));
  } finally {
    busy = false;
  }
}

function search() {
  titleEl.textContent = query ? 'نتائج «' + query + '»' : 'كتب مجانية مختارة';
  run(false);
}

document.getElementById('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  query = input.value.trim();
  input.blur();
  search();
});

document.getElementById('langRow').addEventListener('click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  lang = btn.dataset.lang;
  document.querySelectorAll('#langRow .chip').forEach(c =>
    c.setAttribute('aria-pressed', c === btn ? 'true' : 'false'));
  search();
});

const sug = document.getElementById('suggestions');
SUGGESTIONS.forEach(s => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.textContent = s;
  b.onclick = () => { input.value = s; query = s; search(); };
  sug.append(b);
});

moreBtn.addEventListener('click', () => run(true));

search();
