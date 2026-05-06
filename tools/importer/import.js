/* global WebImporter */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function block(name, rows, doc) {
  const table = doc.createElement('table');
  const headerRow = doc.createElement('tr');
  const th = doc.createElement('th');
  th.setAttribute('colspan', String(Math.max(...rows.map((r) => r.length), 1)));
  th.textContent = name;
  headerRow.appendChild(th);
  table.appendChild(headerRow);
  rows.forEach((row) => {
    const tr = doc.createElement('tr');
    row.forEach((cell) => {
      const td = doc.createElement('td');
      // CRITICAL: nodeType check — instanceof Node fails in AEM Importer sandbox
      if (cell && cell.nodeType) td.appendChild(cell);
      else td.innerHTML = String(cell ?? '');
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  return table;
}

// Wrap a block table in a <div> so it forms its own EDS section
function wrapSection(el, doc) {
  const div = doc.createElement('div');
  div.appendChild(el);
  return div;
}

function primaryButton(doc, href, text) {
  const p = doc.createElement('p');
  const strong = doc.createElement('strong');
  const a = doc.createElement('a');
  a.href = href;
  a.textContent = text;
  strong.appendChild(a);
  p.appendChild(strong);
  return p;
}

function fixLazyImages(root) {
  root.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original]').forEach((img) => {
    img.src = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.src;
  });
  root.querySelectorAll('img[data-srcset]').forEach((img) => {
    img.srcset = img.dataset.srcset;
  });
}

// ---------------------------------------------------------------------------
// Cleanup — remove chrome, overlays, and Colgate-specific noise
// ---------------------------------------------------------------------------
function cleanup(doc) {
  WebImporter.DOMUtils.remove(doc, [
    'header',
    'nav',
    'footer',
    // Cookie / consent
    '#onetrust-consent-sdk',
    '.cookie-banner',
    '[id*="cookie"]',
    '[class*="consent"]',
    // Chat / support widgets
    '[class*="chat-widget"]',
    '#drift-widget',
    '#intercom-container',
    // Sticky / overlays
    '.sticky-header',
    '[data-sticky]',
    '#app-loading',
    '.loading-overlay',
    // Skip links
    '.skip-to-content',
    '#skip-link',
    // Colgate chrome
    '.hamburguer-menu-icon',
    '[class*="exit-warning"]',
    '[class*="language-selector"]',
    '[class*="region-selector"]',
    '.vertical-spacer',
    // AEM edit-mode artefacts
    '.new.section',
    '.aem-Grid-newComponent',
  ]);
}

// ---------------------------------------------------------------------------
// Metadata — OG, Twitter, hreflang, JSON-LD
// ---------------------------------------------------------------------------
function buildMetadata(doc) {
  const meta = {};

  const title = doc.querySelector('title');
  if (title) meta.Title = title.textContent.trim();

  const desc = doc.querySelector('meta[name="description"]');
  if (desc) meta.Description = desc.getAttribute('content');

  const ogImg = doc.querySelector('meta[property="og:image"]');
  if (ogImg) meta.Image = ogImg.getAttribute('content');

  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) meta['Canonical URL'] = canonical.getAttribute('href');

  const ogType = doc.querySelector('meta[property="og:type"]');
  if (ogType) meta['OG Type'] = ogType.getAttribute('content');

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) meta['OG Title'] = ogTitle.getAttribute('content');

  const twitterCard = doc.querySelector('meta[name="twitter:card"]');
  if (twitterCard) meta['Twitter Card'] = twitterCard.getAttribute('content');

  const robots = doc.querySelector('meta[name="robots"]');
  if (robots) meta.Robots = robots.getAttribute('content');

  const hreflangs = [...doc.querySelectorAll('link[rel="alternate"][hreflang]')];
  if (hreflangs.length > 0) {
    meta.hreflang = hreflangs
      .map((l) => `${l.getAttribute('hreflang')}: ${l.getAttribute('href')}`)
      .join('\n');
  }

  const jsonLd = doc.querySelector('script[type="application/ld+json"]');
  if (jsonLd) {
    try {
      const parsed = JSON.parse(jsonLd.textContent);
      meta['Schema Type'] = parsed['@type'] || '';
    } catch (_) { /* ignore malformed JSON-LD */ }
  }

  return WebImporter.Blocks.getMetadataBlock(doc, meta);
}

// ---------------------------------------------------------------------------
// Fix links and image srcs to absolute/relative
// ---------------------------------------------------------------------------
function fixLinks(main, url) {
  const { origin, hostname } = new URL(url);
  main.querySelectorAll('a[href]').forEach((a) => {
    try {
      const abs = new URL(a.getAttribute('href'), origin);
      a.href = abs.hostname === hostname
        ? abs.pathname + abs.search + abs.hash
        : abs.href;
    } catch (_) { /* leave malformed hrefs */ }
  });
  main.querySelectorAll('img[src]').forEach((img) => {
    try {
      img.src = new URL(img.getAttribute('src'), origin).href;
    } catch (_) { /* skip */ }
  });
}

// ---------------------------------------------------------------------------
// Hero Carousel — homepage + sustainability (≥2 slides)
// ---------------------------------------------------------------------------
function transformCarousel(main, doc) {
  const carousel = main.querySelector([
    '.cmp-carousel',
    '[data-cmp-is="carousel"]',
    'section.carousel',
    '[class*="carousel-container"]',
    '[class*="slider-container"]',
  ].join(', '));
  if (!carousel) return;

  const slides = carousel.querySelectorAll([
    '.cmp-carousel__item',
    '[class*="carousel-item"]',
    '.carousel-slide',
    'article',
  ].join(', '));
  if (slides.length < 2) return; // single slide → hero transformer

  const rows = [];
  slides.forEach((slide) => {
    const img = slide.querySelector('img');
    const heading = slide.querySelector('h1, h2, h3, .cmp-teaser__title, .cmp-carousel__title');
    const text = slide.querySelector('p, .cmp-teaser__description');
    const cta = slide.querySelector('a.cmp-teaser__action-link, a[class*="btn"], a[class*="cta"], a');

    const cell = doc.createElement('div');
    if (img) cell.appendChild(img.cloneNode(true));
    if (heading) cell.appendChild(heading.cloneNode(true));
    if (text) cell.appendChild(text.cloneNode(true));
    if (cta) cell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));
    rows.push([cell]);
  });

  if (rows.length > 0) carousel.replaceWith(wrapSection(block('Carousel', rows, doc), doc));
}

// ---------------------------------------------------------------------------
// Hero Banner — single full-width banner
// ---------------------------------------------------------------------------
function transformHero(main, doc) {
  const hero = main.querySelector([
    '.cmp-teaser--hero',
    '[data-cmp-is="teaser"][class*="hero"]',
    '[class*="hero-banner"]',
    '.our-brands-hero-banner',
    '[class*="page-hero"]',
    '.page-banner',
    '.hero',
  ].join(', '));
  if (!hero) return;

  const img = hero.querySelector('img');
  const heading = hero.querySelector('h1, h2, .cmp-teaser__title');
  const text = hero.querySelector('p, .cmp-teaser__description');
  const cta = hero.querySelector('a.cmp-teaser__action-link, a[class*="btn"], a[class*="cta"], a');

  const mediaCell = doc.createElement('div');
  if (img) mediaCell.appendChild(img.cloneNode(true));

  const contentCell = doc.createElement('div');
  if (heading) contentCell.appendChild(heading.cloneNode(true));
  if (text) contentCell.appendChild(text.cloneNode(true));
  if (cta) contentCell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));

  const rows = mediaCell.hasChildNodes() && contentCell.hasChildNodes()
    ? [[mediaCell, contentCell]]
    : [[mediaCell.hasChildNodes() ? mediaCell : contentCell]];

  if (rows[0][0].hasChildNodes()) {
    hero.replaceWith(wrapSection(block('Hero', rows, doc), doc));
  }
}

// ---------------------------------------------------------------------------
// Card Grid — 4-up cards
// ---------------------------------------------------------------------------
function transformCards(main, doc) {
  const grids = main.querySelectorAll([
    '[data-cmp-is="list"]',
    '.cmp-list',
    '[class*="card-grid"]',
    '[class*="cards-container"]',
    '[class*="teaser-grid"]',
    '.card-grid',
  ].join(', '));

  grids.forEach((grid) => {
    const cards = grid.querySelectorAll([
      '.cmp-teaser',
      '.cmp-list__item',
      '[data-cmp-is="teaser"]',
      '[class*="card-item"]',
      '.card',
      'article',
    ].join(', '));
    if (cards.length === 0) return;

    const rows = [];
    cards.forEach((card) => {
      const img = card.querySelector('img');
      const heading = card.querySelector('h3, h4, .cmp-teaser__title, .cmp-list__item-title');
      const desc = card.querySelector('p, .cmp-teaser__description, .cmp-list__item-description');
      const cta = card.querySelector('a.cmp-teaser__action-link, a[class*="btn"], a[class*="cta"], a');

      const cell = doc.createElement('div');
      if (img) cell.appendChild(img.cloneNode(true));
      if (heading) cell.appendChild(heading.cloneNode(true));
      if (desc) cell.appendChild(desc.cloneNode(true));
      if (cta && cta !== heading?.querySelector('a') && cta.textContent.trim()) {
        cell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));
      }
      rows.push([cell]);
    });

    if (rows.length > 0) grid.replaceWith(wrapSection(block('Cards', rows, doc), doc));
  });
}

// ---------------------------------------------------------------------------
// Awards / Recognition Strip — custom block
// ---------------------------------------------------------------------------
function transformAwards(main, doc) {
  const section = main.querySelector([
    '[class*="awards"]',
    '[class*="recognition"]',
    '[class*="achievements"]',
    '[class*="accolades"]',
    '[class*="logos-strip"]',
  ].join(', '));
  if (!section) return;

  const heading = section.querySelector('h2, h3');
  const items = section.querySelectorAll([
    '[class*="award-item"]',
    '[class*="badge"]',
    'figure',
    '[class*="logo-item"]',
    'li',
  ].join(', '));
  if (items.length === 0) return;

  const rows = [];
  if (heading) rows.push([heading.cloneNode(true)]);

  items.forEach((item) => {
    const img = item.querySelector('img');
    const caption = item.querySelector('p, figcaption, span, h4');
    const imgCell = doc.createElement('div');
    const textCell = doc.createElement('div');
    if (img) imgCell.appendChild(img.cloneNode(true));
    if (caption) textCell.innerHTML = caption.innerHTML;
    rows.push([imgCell, textCell]);
  });

  if (rows.length > 0) section.replaceWith(wrapSection(block('Awards', rows, doc), doc));
}

// ---------------------------------------------------------------------------
// Brand Cards — Our Brands page
// ---------------------------------------------------------------------------
function transformBrandCards(main, doc) {
  const brandGrid = main.querySelector([
    '[class*="brand-grid"]',
    '[class*="brands-list"]',
    '[class*="brand-list"]',
  ].join(', '));
  if (!brandGrid) return;

  const brands = brandGrid.querySelectorAll([
    '[class*="brand-card"]',
    '[class*="brand-item"]',
    'article',
    'li',
  ].join(', '));
  if (brands.length === 0) return;

  const rows = [];
  brands.forEach((brand) => {
    const img = brand.querySelector('img');
    const name = brand.querySelector('h3, h4, [class*="brand-name"]');
    const category = brand.querySelector('[class*="category"], [class*="label"], [class*="tag"]');
    const link = brand.querySelector('a');

    const imgCell = doc.createElement('div');
    const contentCell = doc.createElement('div');
    if (img) imgCell.appendChild(img.cloneNode(true));
    if (name) contentCell.appendChild(name.cloneNode(true));
    if (category) contentCell.appendChild(category.cloneNode(true));
    if (link) {
      contentCell.appendChild(
        primaryButton(doc, link.href, link.textContent.trim() || name?.textContent?.trim() || 'Learn more'),
      );
    }
    rows.push([imgCell, contentCell]);
  });

  if (rows.length > 0) brandGrid.replaceWith(wrapSection(block('Brand Cards', rows, doc), doc));
}

// ---------------------------------------------------------------------------
// Columns — CEO message, core values, sustainability pillars
// ---------------------------------------------------------------------------
function transformColumns(main, doc) {
  main.querySelectorAll([
    '.cmp-container--columns',
    '[class*="columns-layout"]',
    '[class*="pillar-section"]',
    '[class*="three-col"]',
    '[class*="two-col"]',
  ].join(', ')).forEach((container) => {
    const cols = [...container.children].filter(
      (c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE',
    );
    if (cols.length < 2) return;

    const row = cols.map((col) => {
      const cell = doc.createElement('div');
      cell.innerHTML = col.innerHTML;
      return cell;
    });

    container.replaceWith(wrapSection(block('Columns', [row], doc), doc));
  });
}

// ---------------------------------------------------------------------------
// Accordion — sustainability collapsible sections
// ---------------------------------------------------------------------------
function transformAccordion(main, doc) {
  main.querySelectorAll('details').forEach((details) => {
    const summary = details.querySelector('summary');
    const body = doc.createElement('div');
    [...details.children].forEach((c) => {
      if (c.tagName !== 'SUMMARY') body.appendChild(c.cloneNode(true));
    });
    details.replaceWith(
      wrapSection(block('Accordion', [[summary?.textContent?.trim() || '', body]], doc), doc),
    );
  });

  main.querySelectorAll([
    '.cmp-accordion',
    '[data-cmp-is="accordion"]',
    '[class*="accordion-component"]',
  ].join(', ')).forEach((acc) => {
    const items = acc.querySelectorAll('.cmp-accordion__item, [class*="accordion-item"]');
    if (items.length === 0) return;

    const rows = items.map((item) => {
      const title = item.querySelector(
        '.cmp-accordion__header, button[aria-controls], [class*="accordion-title"]',
      );
      const content = item.querySelector(
        '.cmp-accordion__panel, [class*="accordion-panel"], [class*="accordion-content"]',
      );
      const contentCell = doc.createElement('div');
      if (content) contentCell.innerHTML = content.innerHTML;
      return [title?.textContent?.trim() || '', contentCell];
    });

    acc.replaceWith(wrapSection(block('Accordion', rows, doc), doc));
  });
}

// ---------------------------------------------------------------------------
// Video Embeds
// ---------------------------------------------------------------------------
function transformVideo(main, doc) {
  main.querySelectorAll([
    'iframe[src*="youtube"]',
    'iframe[src*="vimeo"]',
    '.cmp-video',
    '[data-cmp-is="video"]',
    '[class*="video-embed"]',
    '[class*="video-container"]',
  ].join(', ')).forEach((el) => {
    let src = el.getAttribute('src') || el.getAttribute('data-src') || '';
    if (!src) {
      const iframe = el.querySelector('iframe');
      src = iframe?.getAttribute('src') || iframe?.getAttribute('data-src') || '';
    }
    if (!src) return;

    const a = doc.createElement('a');
    a.href = src;
    a.textContent = src;
    const p = doc.createElement('p');
    p.appendChild(a);
    el.replaceWith(wrapSection(block('Embed', [[p]], doc), doc));
  });
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------
function transformBreadcrumbs(main, doc) {
  const bc = main.querySelector([
    '.cmp-breadcrumb',
    '[data-cmp-is="breadcrumb"]',
    '[aria-label="Breadcrumb"]',
    '[class*="breadcrumb"]',
  ].join(', '));
  if (!bc) return;

  const items = [...bc.querySelectorAll('a, .cmp-breadcrumb__item, li')];
  if (items.length === 0) return;

  const cell = doc.createElement('div');
  items.forEach((item) => {
    if (item.tagName === 'A') {
      cell.appendChild(item.cloneNode(true));
    } else {
      const link = item.querySelector('a');
      if (link) cell.appendChild(link.cloneNode(true));
      else {
        const span = doc.createElement('span');
        span.textContent = item.textContent.trim();
        cell.appendChild(span);
      }
    }
  });

  bc.replaceWith(block('Breadcrumbs', [[cell]], doc));
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
function transformForms(main, doc) {
  main.querySelectorAll('form').forEach((form) => {
    const formId = form.id || form.getAttribute('name') || 'contact';
    form.replaceWith(wrapSection(block('Form', [[`/forms/${formId}`]], doc), doc));
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default {
  /**
   * preprocess runs before transform.
   * replaceBackgroundByImage converts CSS background-image to <img> elements,
   * which is required for AEM hero/banner sections to render correctly.
   */
  preprocess({ document: doc }) {
    WebImporter.DOMUtils.replaceBackgroundByImage(doc);
  },

  transform({ document: doc, url }) {
    cleanup(doc);

    const main = doc.querySelector('main, [role="main"], #main-content, #main')
      || doc.body;

    fixLinks(main, url);
    fixLazyImages(main);

    const path = new URL(url).pathname;

    transformBreadcrumbs(main, doc);
    transformCarousel(main, doc);
    transformHero(main, doc);
    transformAccordion(main, doc);
    transformVideo(main, doc);
    transformColumns(main, doc);

    if (path.includes('/local-brands') || path.includes('/our-brands')) {
      transformBrandCards(main, doc);
    } else {
      transformCards(main, doc);
    }

    transformAwards(main, doc);
    transformForms(main, doc);

    main.append(wrapSection(buildMetadata(doc), doc));

    return [{
      element: main,
      path: path.replace(/\/$/, '') || '/index',
    }];
  },
};
