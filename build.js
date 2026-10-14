// Builds the Si Señor site from the editable files in /content.
// No outside packages: Netlify runs `node build.js` and publishes /dist.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));

const biz = read('business.json');
const seo = read('seo.json');
const specials = read('specials.json');
const photos = read('photos.json').items || [];
const menuFile = read('menu.json');
const menu = menuFile.categories || [];
const homeMenu = read('home-menu.json');
const reviews = read('reviews.json');
const home = read('homepage.json');
const hero = home.hero || {};

// ---------- helpers ----------
function fail(msg) { console.error('\nBUILD STOPPED: ' + msg + '\n'); process.exit(1); }
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = (arr) => (arr || []).map((x) => (x && typeof x === 'object' ? x.text : x)).filter(Boolean);
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const siteUrl = String(seo.siteUrl || '').replace(/\/+$/, '');
const abs = (p) => siteUrl + '/' + String(p).replace(/^\/+/, '');
const rel = (p) => String(p || '').replace(/^\/+/, ''); // page uses relative img paths
const digits = String(biz.phone || '').replace(/\D/g, '');
if (digits.length < 10) fail(`Phone "${biz.phone}" doesn't look like a full phone number.`);

// width/height of an uploaded image (PNG, JPEG, WebP) so layout stays stable
function imageSize(p, where) {
  const file = path.join(ROOT, 'src', rel(p));
  if (!fs.existsSync(file)) fail(`${where}: image ${p} not found.`);
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  fail(`${where}: ${p} isn't a PNG, JPEG or WebP image.`);
}
function img(o, sizes, where, extra) {
  const [w, h] = imageSize(o.image, where);
  let srcset = '';
  if (o.imageLarge) {
    const [lw] = imageSize(o.imageLarge, where);
    srcset = ` srcset="${esc(rel(o.image))} ${w}w, ${esc(rel(o.imageLarge))} ${o.imageLargeWidth || lw}w" sizes="${sizes}"`;
  }
  return `<img src="${esc(rel(o.image))}"${srcset} width="${w}" height="${h}" alt="${esc(o.alt || '')}"${extra}>`;
}

function parseTime(t, where) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m || +m[1] > 24 || +m[2] > 59) fail(`${where}: time "${t}" should look like 11:00 or 21:30 (24-hour clock).`);
  return { h: +m[1], m: +m[2] };
}
const label = ({ h, m }) => (((h + 11) % 12) + 1) + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + (h % 24 < 12 ? 'AM' : 'PM');

// ---------- hours ----------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hours = DAYS.map((day, i) => {
  const h = (biz.hours || []).find((x) => String(x.day).toLowerCase() === day.toLowerCase());
  if (!h) fail(`Hours: "${day}" is missing.`);
  if (h.closed) return { day, i, closed: true, note: h.note };
  return { day, i, note: h.note, opens: h.opens.trim(), closes: h.closes.trim(),
    o: parseTime(h.opens, `Hours (${day}) opens`), c: parseTime(h.closes, `Hours (${day}) closes`) };
});

// ---------- menu ----------
const used = new Set();
const cats = menu.map((c) => { let id = slug(c.name); while (used.has(id)) id += '-2'; used.add(id); return { ...c, id }; });
if (!cats.length) fail('The full menu needs at least one section.');

// ---------- blocks ----------
const B = {};
B.ticker = (() => { const s = list(home.ticker).map((t) => `<span>${esc(t)} <i>&#10022;</i></span>`).join(''); return s + '\n' + s; })();
B.highlights = list(hero.highlights).map((t, i) => `<li${i === 0 ? ' class="on"' : ''}>${esc(t)}</li>`).join('') +
  (biz.googleRating ? `<li>${esc(biz.googleRating)}&#9733; on Google</li>` : '');

const L = specials.lunch || {};
const board = `<article class="board rv"><span class="price">${esc(L.price)}</span><span class="k">${esc(L.label)}</span><h3>${esc(L.title)}</h3>` +
  (list(L.options).length ? `<ul>${list(L.options).map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : '') +
  (L.description ? `<p>${esc(L.description)}</p>` : '') +
  `<p class="fine">Specials change daily. Call <a href="tel:+1${digits}" style="color:#fff">${esc(biz.phone)}</a> or ask your server about today&rsquo;s.</p></article>`;
const T = specials.tacoTuesday || {};
let weekly = '';
if (T.show) {
  const dayIdx = DAYS.findIndex((d) => d.toLowerCase() === String(T.day || '').toLowerCase());
  if (dayIdx < 0) fail(`Weekly special: day "${T.day}" should be a day name like Tuesday.`);
  const st = parseTime(T.startsAt, 'Weekly special start time');
  weekly = `<article class="tt rv"><div class="ph">${img(T, '(max-width:800px) 92vw, 460px', 'Weekly special photo', ' loading="lazy" decoding="async"')}` +
    `<span class="tag" id="ttTag" data-day="${dayIdx}" data-start="${esc(T.startsAt)}" data-start-label="${label(st)}">${esc(T.badge)}</span></div>` +
    `<div class="ttb"><span class="k">${esc(T.label)}</span><h3>${esc(T.title)}</h3><span class="when">Starts at ${label(st)}</span><ul>` +
    (T.items || []).map((it) => `<li><span><b>${esc(it.name)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ''}</span><i></i><em>${esc(it.price)}</em></li>`).join('') +
    '</ul></div></article>';
}
B.specials = board + (weekly ? '\n' + weekly : '');

B.photos = photos.map((p, i) => `<figure class="mf rv">${img(p, i === 0 ? '(max-width:800px) 92vw, 640px' : '(max-width:800px) 46vw, 320px', `Photo "${p.caption}"`, ' loading="lazy" decoding="async"')}<figcaption>${esc(p.caption)}</figcaption></figure>`).join('\n');

const shown = Math.max(1, parseInt(homeMenu.itemsShown, 10) || 5);
B.homemenu = (homeMenu.sections || []).map((s) => {
  const name = typeof s === 'object' ? s.category : s;
  const c = cats.find((x) => x.name.trim().toLowerCase() === String(name || '').trim().toLowerCase());
  if (!c) fail(`Menu preview: "${name}" doesn't match any section name in the full menu (${cats.map((x) => x.name).join(', ')}).`);
  const items = c.items || [];
  return `<div class="mp rv"><h3>${esc(c.name)}</h3><ul>` +
    items.slice(0, shown).map((it) => `<li><span>${esc(it.name)}</span><i></i><b>${esc(it.price)}</b></li>`).join('') +
    `</ul><button type="button" class="mp-more" data-open="${c.id}">See all ${items.length} &rarr;</button></div>`;
}).join('');

const rave = list(reviews.raveAbout);
B.rave = rave.length ? `<div class="rave rv">Diners rave about: ${rave.map((r) => `<span>${esc(r)}</span>`).join('')}</div>` : '';
B.quotes = (reviews.quotes || []).map((q) => {
  const n = Math.max(1, Math.min(5, parseInt(q.stars, 10) || 5));
  return `<figure class="q rv"><span class="st" aria-label="${n} stars">${'&#9733;'.repeat(n)}</span><blockquote>&ldquo;${esc(q.quote)}&rdquo;</blockquote><figcaption>${esc(q.author)}${q.source ? ' &middot; ' + esc(q.source) : ''}</figcaption></figure>`;
}).join('\n');
const men = (reviews.mostMentioned || []).filter((m) => m && m.dish);
B.mentions = men.length ? `<div class="mention rv">Most mentioned: ${men.map((m) => `<span><b>${esc(m.dish)}</b>${m.count ? ' &middot; ' + esc(m.count) : ''}</span>`).join('')}</div>` : '';
B.services = list(biz.services).map((s) => `<span>${esc(s)}</span>`).join('');
B.hours = hours.map((h) => {
  const name = `<span>${h.day}${h.note ? ` <em>${esc(h.note)}</em>` : ''}</span>`;
  return h.closed
    ? `<div class="hr" data-d="${h.i}" data-closed="1">${name}<span>Closed</span></div>`
    : `<div class="hr" data-d="${h.i}" data-opens="${h.opens}" data-closes="${h.closes}" data-opens-label="${label(h.o)}" data-closes-label="${label(h.c)}">${name}<span>${label(h.o)} &ndash; ${label(h.c)}</span></div>`;
}).join('');
B.footernote = biz.footerNote ? `<span>${esc(biz.footerNote)}</span>` : '';
B.tabs = cats.map((c) => `<a href="#m-${c.id}" data-cat="${c.id}">${esc(c.name)}</a>`).join('');
B.fullmenu = cats.map((c) => `<section class="mcat" id="m-${c.id}"><h3>${esc(c.name)}</h3>${c.note ? `<p class="mnote">${esc(c.note)}</p>` : ''}<ul>` +
  (c.items || []).map((it) => `<li><div class="mi-h"><h4>${esc(it.name)}</h4><i></i><b>${esc(it.price)}</b></div>${it.description ? `<p>${esc(it.description)}</p>` : ''}</li>`).join('') +
  '</ul></section>').join('');

// ---------- head ----------
const schema = {
  '@context': 'https://schema.org', '@type': 'Restaurant', name: biz.name, url: siteUrl + '/',
  image: [abs('img/og.jpg')], logo: abs('img/si-senor-mascot-420.webp'), telephone: '+1' + digits.slice(-10),
  priceRange: seo.priceRange,
  servesCuisine: (() => { const c = String(seo.cuisine || '').split(',').map((s) => s.trim()).filter(Boolean); return c.length === 1 ? c[0] : c; })(),
  address: { '@type': 'PostalAddress', streetAddress: biz.street, addressLocality: biz.city, addressRegion: biz.state, postalCode: biz.zip, addressCountry: 'US' },
  geo: { '@type': 'GeoCoordinates', latitude: biz.latitude, longitude: biz.longitude },
  hasMap: biz.mapsUrl, menu: siteUrl + '/#menu',
  openingHoursSpecification: hours.filter((h) => !h.closed).map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.day, opens: h.opens, closes: h.closes })),
};
if (biz.googleRating && biz.googleReviewCount) schema.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(biz.googleRating), reviewCount: String(biz.googleReviewCount), bestRating: '5' };
if (biz.mapsUrl) schema.sameAs = [biz.mapsUrl];

B.head = [
  `<title>${esc(seo.title)}</title>`,
  `<meta name="description" content="${esc(seo.description)}">`,
  seo.hideFromGoogle ? '<meta name="robots" content="noindex, nofollow">' : '',
  `<link rel="canonical" href="${esc(siteUrl)}/">`,
  '<meta property="og:type" content="restaurant">',
  `<meta property="og:title" content="${esc(seo.title)}">`,
  `<meta property="og:description" content="${esc(seo.shareDescription || seo.description)}">`,
  `<meta property="og:image" content="${esc(abs('img/og.jpg'))}">`,
  `<meta property="og:url" content="${esc(siteUrl)}/">`,
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="theme-color" content="#d2232a">',
  '<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">',
  '<link rel="icon" type="image/png" sizes="192x192" href="img/favicon-192.png">',
  '<link rel="apple-touch-icon" href="img/apple-touch-icon.png">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Kaushan+Script&family=Figtree:wght@400;600;800&display=swap" rel="stylesheet">',
  '<link rel="preload" as="image" href="img/si-senor-mascot-420.webp">',
  `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
].filter(Boolean).join('\n');

// ---------- render ----------
const tokens = {
  name: biz.name, logoLine1: home.nameLine1, logoLine2: home.nameLine2, kicker: hero.kicker, tagline: hero.tagline, heroButton: hero.buttonText,
  phone: biz.phone, tel: '+1' + digits.slice(-10), street: biz.street, city: biz.city, state: biz.state, zip: biz.zip,
  mapsUrl: biz.mapsUrl, directionsUrl: biz.directionsUrl, nearby: (home.visit || {}).nearby, callbarText: (home.menu || {}).callbarText,
  googleRating: biz.googleRating, googleReviewCount: biz.googleReviewCount,
  specialsIntro: (home.specials || {}).intro,
  specialsHeading: (home.specials || {}).heading, specialsAccent: (home.specials || {}).accent,
  menuHeading: (home.menu || {}).heading, menuAccent: (home.menu || {}).accent, menuIntro: (home.menu || {}).intro,
  reviewsHeading: (home.reviews || {}).heading, reviewsAccent: (home.reviews || {}).accent,
  visitHeading: (home.visit || {}).heading, visitAccent: (home.visit || {}).accent, menuFootnote: menuFile.footnote, firstCategory: cats[0].id,
};
let page = fs.readFileSync(path.join(ROOT, 'src', 'page.html'), 'utf8');
page = page.replace(/<!--@(\w+)-->/g, (m, k) => { if (!(k in B)) fail(`Template block "${k}" has no content.`); return B[k]; });
page = page.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in tokens)) fail(`Template field "${k}" is unknown.`); return esc(tokens[k]); });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), page);
fs.cpSync(path.join(ROOT, 'src', 'img'), path.join(OUT, 'img'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'robots.txt'), seo.hideFromGoogle ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
if (!seo.hideFromGoogle) fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(siteUrl)}/</loc></url></urlset>\n`);

console.log(`Built dist/index.html: ${cats.length} menu sections, ${cats.reduce((n, c) => n + (c.items || []).length, 0)} items, ${photos.length} photos, ${(reviews.quotes || []).length} reviews.`);
