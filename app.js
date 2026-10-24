const API = 'https://gutendex.com/books/';
const SUGGESTIONS = ['Shakespeare', 'Dickens', 'Jane Austen', 'Mark Twain', 'Tolstoy', 'Poetry'];

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const moreBtn = document.getElementById('more');
const titleEl = document.getElementById('sectionTitle');
const input = document.getElementById('q');
const legal = document.getElementById('legal');

let lang = '';
let query = '';
let nextUrl = null;
let busy = false;

function buildUrl() {
  const p = new URLSearchParams();
  if (query) p.set('search', query);
  if (lang) p.set('languages', lang);
  const qs = p.toString();
  return API + (qs ? '?' + qs : '');
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

function pickDownload(b) {
  if (b.copyright === true) return null;
  const f = b.formats || {};
  if (f['application/epub+zip']) return { url: f['application/epub+zip'], ext: 'EPUB' };
  if (f['application/pdf']) return { url: f['application/pdf'], ext: 'PDF' };
  return null;
}

function renderBook(b) {
  const dl = pickDownload(b);
  const title = b.title || 'بدون عنوان';
  const author = (b.authors && b.authors[0] && b.authors[0].name) || 'مؤلف غير معروف';
  const cover = b.formats && b.formats['image/jpeg'];

  const card = document.createElement('article');
  card.className = 'card';

  const cv = document.createElement('div');
  cv.className = 'cover';
  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.textContent = title;
  cv.append(ph);
  if (cover) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = cover;
    img.onload = () => ph.remove();
    img.onerror = () => img.remove();
    cv.append(img);
  }
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = dl ? dl.ext : 'محمي';
  cv.append(badge);

  const info = document.createElement('div');
  info.className = 'info';
  const t = document.createElement('div');
  t.className = 't';
  t.textContent = title;
  const a = document.createElement('div');
  a.className = 'a';
  a.textContent = author;
  info.append(t, a);

  const act = document.createElement('div');
  act.className = 'actions';
  if (dl) {
    const link = document.createElement('a');
    link.className = 'btn primary';
    link.href = dl.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('download', '');
    link.textContent = 'تحميل';
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

async function load(url, append) {
  if (busy) return;
  busy = true;
  moreBtn.hidden = true;
  if (!append) grid.replaceChildren();
  showStatus('loading', 'جارٍ التحميل...');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const results = data.results || [];
    results.forEach(b => grid.append(renderBook(b)));
    nextUrl = data.next ? data.next.replace(/^http:/, 'https:') : null;
    if (!grid.children.length) {
      showStatus('empty', 'لا توجد نتائج. جرّب كلمة أخرى أو غيّر اللغة.');
    } else {
      hideStatus();
    }
    moreBtn.hidden = !nextUrl;
  } catch (e) {
    showStatus('error', 'تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.', () => load(url, append));
  } finally {
    busy = false;
  }
}

function search() {
  titleEl.textContent = query ? 'نتائج «' + query + '»' : 'الأكثر تحميلاً';
  load(buildUrl(), false);
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

moreBtn.addEventListener('click', () => { if (nextUrl) load(nextUrl, true); });

search();
