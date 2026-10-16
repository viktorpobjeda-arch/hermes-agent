import { normalizeProducts, filterProducts, buildInquiry, safeContact } from './catalogue.js';

const $ = selector => document.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function graphic(kind = '↗') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'graphic-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  const paths = {
    '↗': 'M5 19 19 5M5 5h14v14',
    '↘': 'M5 5 19 19M5 19h14V5',
    '↑': 'M12 21V3M4 11l8-8 8 8',
    '✕': 'm6 6 12 12M6 18 18 6',
    '×': 'm6 6 12 12M6 18 18 6',
    '+': 'M12 4v16M4 12h16',
    '↺': 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
    '✳': 'M12 1v22M1 12h22M4 4l16 16M4 20 20 4'
  };
  path.setAttribute('d', paths[kind] || paths['↗']);
  if (kind === '✳') svg.setAttribute('stroke-width', '3.8');
  svg.append(path);
  return svg;
}
function actionLabel(node, text, kind = '↗') {
  const arrow = make('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.append(graphic(kind));
  node.replaceChildren(document.createTextNode(text), arrow);
}
function decorateStaticIcons() {
  const selectors = '.button span,.mobile-nav a span,.text-button span,.style-name>span,.site-footer>a>span,.close-dialog,.faq summary>span';
  document.querySelectorAll(selectors).forEach(node => {
    const symbol = node.textContent.trim();
    if (['↗', '↘', '↑', '✕', '✳', '+', '↺'].includes(symbol)) node.replaceChildren(graphic(symbol));
  });
}
decorateStaticIcons();
const icon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M12 20.5 3.7 12.3a5.2 5.2 0 0 1 7.4-7.3l.9 1 .9-1a5.2 5.2 0 0 1 7.4 7.3Z');
  svg.append(path);
  return svg;
};
const state = { products: [], config: { brand: 'SneakTok' }, selected: [], error: false };
const storageKey = 'sneaktok-selection-v1';
let toastTimer;
let currentProduct;
let lastOpener;
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500);
}
function loadSelection() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(value)) state.selected = value.filter(item => item && state.products.some(product => product.id === item.id)).map(item => ({ id: item.id, size: typeof item.size === 'string' ? item.size.slice(0, 20) : '' })).filter((item, index, items) => items.findIndex(other => other.id === item.id) === index);
  } catch { state.selected = []; }
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state.selected)); }
  catch { notify('Preglednik ne može spremiti izbor. Ostaje dostupan dok je stranica otvorena.'); }
}
function invalidateInquiry() { $('#inquiry-output').hidden = true; }
function updateSelection() {
  $('#selection-count').textContent = state.selected.length;
  $('#open-selection').setAttribute('aria-label', `Moj izbor, ${state.selected.length} spremljenih modela`);
  document.querySelectorAll('.save-product').forEach(button => {
    const saved = state.selected.some(item => item.id === button.dataset.id);
    const product = state.products.find(product => product.id === button.dataset.id);
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', `${saved ? 'Ukloni iz izbora' : 'Spremi u moj izbor'}: ${product?.name || ''}`);
  });
  if (currentProduct) {
    const saved = state.selected.some(item => item.id === currentProduct.id);
    const button = $('#detail-save');
    if (button) actionLabel(button, saved ? 'Ažuriraj željenu veličinu' : 'Dodaj u moj izbor');
  }
}
function toggleSave(product) {
  const existing = state.selected.findIndex(item => item.id === product.id);
  if (existing >= 0) { state.selected.splice(existing, 1); notify('Model je uklonjen iz izbora.'); }
  else { state.selected.push({ id: product.id, size: '' }); notify('Spremljeno u Moj izbor. Dodaj svoj EU broj.'); }
  persist();
  invalidateInquiry();
  updateSelection();
}
function imageNode(image, className, eager = false) {
  const img = make('img', className);
  img.src = image.src;
  img.alt = image.alt;
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  if (Number.isInteger(image.width) && Number.isInteger(image.height) && image.width > 0 && image.height > 0) {
    img.width = image.width;
    img.height = image.height;
  }
  return img;
}
function productCard(product, index) {
  const card = make('article', 'product-card');
  const imageWrap = make('div', 'product-image-wrap');
  const open = make('button', 'product-open');
  open.type = 'button';
  open.setAttribute('aria-label', `Pogledaj model: ${product.name}`);
  open.setAttribute('aria-haspopup', 'dialog');
  open.append(imageNode(product.images[0], '', index < 4));
  open.addEventListener('click', () => openProduct(product, open));
  const save = make('button', 'save-product');
  save.type = 'button';
  save.dataset.id = product.id;
  save.append(icon());
  save.addEventListener('click', () => toggleSave(product));
  imageWrap.append(open, save);
  const meta = make('p', 'card-meta', [product.brand, product.category].filter(Boolean).join(' / ') || 'SneakTok izbor');
  const heading = make('h3', 'card-title');
  const title = make('button', '', product.name);
  title.type = 'button';
  title.setAttribute('aria-haspopup', 'dialog');
  title.addEventListener('click', () => openProduct(product, title));
  heading.append(title);
  card.append(imageWrap, meta, heading, make('p', 'card-price', product.price || 'Cijena na upit'));
  if (product.color) card.append(make('p', 'card-color', product.color));
  return card;
}
function renderCatalog() {
  const query = $('#search').value;
  const brand = $('#brand-filter').value;
  const category = $('#category-filter').value;
  const filtered = filterProducts(state.products, query, brand, category, $('#sort').value);
  const hasFilters = Boolean(query || brand || category);
  $('#product-grid').replaceChildren(...filtered.map(productCard));
  $('#catalog-tools').hidden = !state.products.length;
  $('#results-meta').hidden = !state.products.length;
  $('#result-count').textContent = state.products.length ? `${filtered.length} / ${state.products.length} modela` : '';
  $('#reset-filters').hidden = !hasFilters;
  const empty = $('#catalog-empty');
  empty.hidden = filtered.length > 0;
  if (!filtered.length) {
    const noResults = state.products.length > 0;
    $('#empty-kicker').textContent = noResults ? 'JOŠ NISMO PRONAŠLI TAJ PAR.' : 'POGLEDAJ MODELE';
    $('#empty-title').textContent = noResults ? 'Drugi pojam. Novi favoriti.' : state.error ? 'Katalog se nije učitao.' : 'Kolekcija počinje u albumu.';
    $('#empty-copy').textContent = noResults ? 'Pokušaj s drugim nazivom ili ukloni filtere. Ako znaš što tražiš, možeš to napisati i u upitu.' : state.error ? 'Pokušaj osvježiti stranicu. I dalje možeš otvoriti album i poslati upit.' : 'Za pregled modela otvori izvorni album. Poveznicu na odabrani par i svoj EU broj dodaj u upit.';
  }
  updateSelection();
}
function setupFilters() {
  const populate = (key, select) => {
    const options = [...new Set(state.products.map(product => product[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hr'));
    options.forEach(value => {
      const option = make('option', '', value);
      option.value = value;
      select.append(option);
    });
    select.parentElement.hidden = options.length < 2;
    return options.length >= 2;
  };
  const brands = populate('brand', $('#brand-filter'));
  const categories = populate('category', $('#category-filter'));
  $('#filters').hidden = !brands && !categories;
  $('#sort-wrap').hidden = state.products.length < 2;
}
function setMenu(open) {
  $('#mobile-nav').hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', open ? 'Zatvori izbornik' : 'Otvori izbornik');
}
function openDialog(dialog, opener) {
  setMenu(false);
  lastOpener = opener || document.activeElement;
  dialog.showModal();
  dialog.querySelector('.close-dialog').focus();
}
function openProduct(product, opener) {
  currentProduct = product;
  const detail = $('#product-detail');
  const gallery = make('div', 'detail-gallery');
  const main = imageNode(product.images[0], 'detail-main-img', true);
  gallery.append(main);
  if (product.images.length > 1) {
    const thumbs = make('div', 'gallery-thumbs');
    product.images.forEach((image, index) => {
      const button = make('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Fotografija ${index + 1}: ${image.alt}`);
      button.setAttribute('aria-pressed', String(index === 0));
      const thumbnail = imageNode(image);
      thumbnail.alt = '';
      button.append(thumbnail);
      button.addEventListener('click', () => {
        main.src = image.src;
        main.alt = image.alt;
        thumbs.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      });
      thumbs.append(button);
    });
    gallery.append(thumbs);
  }
  const copy = make('div', 'detail-copy');
  copy.append(make('p', 'eyebrow', [product.brand, product.category].filter(Boolean).join(' / ') || 'SNEAKTOK IZBOR'));
  const title = make('h2', '', product.name);
  title.id = 'product-title';
  copy.append(title, make('p', 'detail-price', product.price || 'Cijena na upit'));
  if (product.color) copy.append(make('p', 'detail-description', product.color));
  if (product.description) copy.append(make('p', 'detail-description', product.description));
  const label = make('label', 'field-label', 'Željeni EU broj');
  label.htmlFor = 'detail-size';
  const size = make('input', 'detail-size');
  size.id = 'detail-size';
  size.type = 'text';
  size.inputMode = 'decimal';
  size.maxLength = 20;
  size.placeholder = 'Npr. 42 ili 42,5';
  size.value = state.selected.find(item => item.id === product.id)?.size || '';
  const save = make('button', 'button button-dark full-width');
  save.id = 'detail-save';
  save.type = 'button';
  save.addEventListener('click', () => {
    const existing = state.selected.find(item => item.id === product.id);
    if (existing) existing.size = size.value.trim();
    else state.selected.push({ id: product.id, size: size.value.trim() });
    persist();
    invalidateInquiry();
    updateSelection();
    notify('Tvoj izbor je spremljen. Upit pripremi u Moj izbor.');
  });
  const source = make('a', 'detail-source');
  actionLabel(source, 'Fotografije i model u izvornom albumu');
  source.href = product.sourceUrl;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  copy.append(label, size, make('p', 'detail-note', 'Upiši veličinu koju tražiš. Dostupnost i cijenu potvrđuje prodavatelj; dodavanje u izbor nije rezervacija.'), save, source);
  detail.replaceChildren(gallery, copy);
  updateSelection();
  openDialog($('#product-dialog'), opener);
}
function renderSelection() {
  const target = $('#selection-items');
  target.replaceChildren();
  if (!state.selected.length) {
    const empty = make('div', 'selection-empty');
    empty.append(make('h3', '', 'Tvoj izbor tek počinje.'), make('p', '', 'Spremi model iz kataloga ili odmah sastavi opći upit. Napiši koje tenisice i veličinu tražiš.'));
    target.append(empty);
  }
  state.selected.forEach(item => {
    const product = state.products.find(product => product.id === item.id);
    const row = make('article', 'selected-item');
    row.append(imageNode(product.images[0]));
    const copy = make('div');
    copy.append(make('h3', '', product.name), make('p', '', product.price || 'Cijena na upit'));
    const sizeLabel = make('label', 'selected-size', 'EU broj');
    const input = make('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.maxLength = 20;
    input.placeholder = 'Npr. 42';
    input.value = item.size;
    input.setAttribute('aria-label', `Željeni EU broj za ${product.name}`);
    input.addEventListener('input', () => { item.size = input.value; persist(); invalidateInquiry(); });
    sizeLabel.append(input);
    copy.append(sizeLabel);
    const remove = make('button', 'remove-item');
    remove.append(graphic('×'));
    remove.type = 'button';
    remove.setAttribute('aria-label', `Ukloni iz izbora: ${product.name}`);
    remove.addEventListener('click', () => {
      toggleSave(product);
      renderSelection();
      const next = $('#selection-items .remove-item') || $('#general-size');
      next.focus();
    });
    row.append(copy, remove);
    target.append(row);
  });
}
function openSelection(opener) {
  renderSelection();
  openDialog($('#selection-dialog'), opener);
}
$('#menu-toggle').addEventListener('click', () => setMenu($('#mobile-nav').hidden));
$('#mobile-nav').querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
matchMedia('(min-width: 721px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#mobile-nav').hidden) { setMenu(false); $('#menu-toggle').focus(); }
  if (event.key === '/' && !$('#catalog-tools').hidden && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
  dialog.addEventListener('close', () => { lastOpener?.focus(); });
});
['open-selection', 'empty-action', 'info-inquiry'].forEach(id => $(`#${id}`).addEventListener('click', event => openSelection(event.currentTarget)));
document.querySelectorAll('.style-card').forEach(button => button.addEventListener('click', () => {
  const suggestion = `Zanimaju me tenisice u ${button.dataset.style}. Možete li mi poslati dostupne modele?`;
  if (!$('#inquiry-note').value.includes(suggestion)) {
    $('#inquiry-note').value = [$('#inquiry-note').value.trim(), suggestion].filter(Boolean).join('\n').slice(0, 1000);
  }
  invalidateInquiry();
  openSelection(button);
}));
$('#search').addEventListener('input', renderCatalog);
['brand-filter', 'category-filter', 'sort'].forEach(id => $(`#${id}`).addEventListener('change', renderCatalog));
$('#reset-filters').addEventListener('click', () => {
  $('#search').value = '';
  $('#brand-filter').value = '';
  $('#category-filter').value = '';
  renderCatalog();
  $('#search').focus();
});
$('#inquiry-form').addEventListener('input', invalidateInquiry);
$('#inquiry-form').addEventListener('submit', event => {
  event.preventDefault();
  $('#inquiry-text').value = buildInquiry({ brand: state.config.brand, items: state.selected.map(item => ({ product: state.products.find(product => product.id === item.id), size: item.size })), generalSize: $('#general-size').value, note: $('#inquiry-note').value });
  const contact = safeContact(state.config.orderContactUrl);
  $('#contact-link').hidden = !contact;
  if (contact) {
    const target = new URL(contact);
    if (target.protocol === 'https:' && target.hostname === 'wa.me') target.searchParams.set('text', $('#inquiry-text').value);
    $('#contact-link').href = target.href;
    actionLabel($('#contact-link'), state.config.orderContactLabel || 'Otvori kontakt');
    $('#contact-link').target = '_blank';
    $('#contact-link').rel = 'noopener noreferrer';
    $('#contact-note').textContent = target.hostname === 'wa.me' ? 'Poruku šalješ ti, u WhatsAppu. Otvaranje upita nije potvrda narudžbe.' : 'Kopiraj upit pa ga zalijepi u razgovor. Provjeri sve detalje prije narudžbe.';
    $('#contact-link').classList.replace('button-dark', 'button-accent');
    $('#copy-inquiry').classList.replace('button-accent', 'button-secondary');
  } else {
    $('#contact-note').textContent = 'Kontakt trenutačno nije dostupan. Kopiraj i sačuvaj upit; poruka se ne šalje automatski.';
  }
  $('#inquiry-output').hidden = false;
  $('#inquiry-text').focus();
  $('#inquiry-output').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
$('#copy-inquiry').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard not available');
    await navigator.clipboard.writeText($('#inquiry-text').value);
    notify('Upit je kopiran. Poruka nije poslana.');
  } catch {
    $('#inquiry-text').focus();
    $('#inquiry-text').select();
    notify('Označili smo tekst. Kopiraj ga iz izbornika preglednika.');
  }
});
async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Cannot load ${path}: ${response.status}`);
  return response.json();
}
async function init() {
  const [config, source] = await Promise.allSettled([loadJSON('./config.json'), loadJSON('./source-data.json')]);
  if (config.status === 'fulfilled' && config.value && typeof config.value.brand === 'string') state.config = config.value;
  const footerContact = safeContact(state.config.orderContactUrl);
  $('#footer-contact').hidden = !footerContact;
  if (footerContact) {
    $('#footer-contact').href = footerContact;
    actionLabel($('#footer-contact'), new URL(footerContact).hostname === 'wa.me' ? 'WhatsApp kontakt' : 'Kontakt');
  }
  if (source.status === 'fulfilled') state.products = normalizeProducts(source.value.products);
  else state.error = true;
  loadSelection();
  setupFilters();
  renderCatalog();
}
init();
