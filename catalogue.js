// Shared data contract: only source-traceable products with local photos are shown.
export function safeLocalImage(value) {
  return typeof value === 'string' && /^assets\/products\/[a-zA-Z0-9_./-]+\.(?:avif|webp|jpe?g|png)$/i.test(value) && !value.includes('..');
}
export function safeSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === '2335499519.x.yupoo.com' && /^\/albums\/\d+\/?$/.test(url.pathname);
  } catch { return false; }
}
export function normalizeProducts(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set();
  return raw.flatMap(product => {
    if (!product || typeof product.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(product.id) || ids.has(product.id) || typeof product.name !== 'string' || !product.name.trim() || !safeSource(product.sourceUrl)) return [];
    const images = (Array.isArray(product.images) ? product.images : []).filter(image => image && safeLocalImage(image.src) && typeof image.alt === 'string' && image.alt.trim());
    if (!images.length) return [];
    ids.add(product.id);
    const text = key => typeof product[key] === 'string' ? product[key].trim() : '';
    return [{ id: product.id, name: product.name.trim(), brand: text('brand'), category: text('category'), color: text('color'), description: text('description'), price: text('price'), sourceUrl: product.sourceUrl, images }];
  });
}
export function filterProducts(products, query = '', brand = '', category = '', sort = 'featured') {
  const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hr');
  const tokens = normalized(query.trim()).split(/\s+/).filter(Boolean);
  const result = products.filter(product => (!brand || product.brand === brand) && (!category || product.category === category) && tokens.every(token => normalized([product.name, product.brand, product.category, product.color].join(' ')).includes(token)));
  return sort === 'name' ? result.sort((a, b) => a.name.localeCompare(b.name, 'hr')) : result;
}
export function buildInquiry({ brand = 'SneakTok', items = [], generalSize = '', note = '' }) {
  const lines = [`Pozdrav ${brand}!`, '', items.length ? 'Zanimaju me sljedeće tenisice:' : 'Zanima me vaša ponuda tenisica.'];
  items.forEach(({ product, size }, index) => {
    lines.push(`${index + 1}. ${[product.brand, product.name].filter(Boolean).join(' — ')}`, `   Željeni EU broj: ${size.trim() || 'molim pomoć oko veličine'}`, `   Model: ${product.sourceUrl}`);
  });
  if (generalSize.trim()) lines.push('', `Moj EU broj: ${generalSize.trim()}.`);
  if (note.trim()) lines.push('', note.trim());
  lines.push('', 'Molim potvrdu cijene i dostupnosti za željenu veličinu te informacije o dostavi i načinu plaćanja. Hvala!');
  return lines.join('\n');
}
export function safeContact(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
