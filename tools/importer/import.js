/* global WebImporter */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function block(name, rows, doc) {
  const table = doc.createElement('table');
  const thead = doc.createElement('tr');
  const th = doc.createElement('th');
  th.setAttribute('colspan', String(Math.max(...rows.map((r) => r.length), 1)));
  th.textContent = name;
  thead.appendChild(th);
  table.appendChild(thead);
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

function wrapSection(el) {
  const div = document.createElement('div');
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

function extractBgImage(el) {
  // AEM encodes '/' as '\2f' in background-image style attributes
  const m = (el?.getAttribute('style') ?? '').match(/background-image:\s*url\(([^)]+)\)/i);
  return m ? m[1].replace(/\\2f/gi, '/').replace(/['"]/g, '').trim() : null;
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
    // Sticky bars / overlays
    '.sticky-header',
    '[data-sticky]',
    '#app-loading',
    '.loading-overlay',
    // Skip links
    '.skip-to-content',
    '#skip-link',
    // Colgate-specific chrome
    '.hamburguer-menu-icon',
    '[class*="exit-warning"]',
    '[class*="language-selector"]',
    '[class*="region-selector"]',
    '.vertical-spacer',
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

  const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) meta['Twitter Title'] = twitterTitle.getAttribute('content');

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

  return block('Metadata', Object.entries(meta).map(([k, v]) => [k, v ?? '']), doc);
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
// Selectors: section.carousel, .cmp-carousel, .carousel-container
// ---------------------------------------------------------------------------
function transformCarousel(main, doc) {
  const carousel = main.querySelector(
    'section.carousel, .cmp-carousel, [class*="carousel-container"], [class*="slider"]',
  );
  if (!carousel) return;

  const slides = carousel.querySelectorAll(
    '.carousel-slide, .cmp-carousel__item, [class*="carousel-item"], article',
  );
  if (slides.length < 2) return; // single slide → handled by hero

  const rows = [];
  slides.forEach((slide) => {
    const img = slide.querySelector('img');
    const bgSrc = extractBgImage(slide) || extractBgImage(slide.querySelector('[style]'));
    const heading = slide.querySelector('h1, h2, h3');
    const text = slide.querySelector('p');
    const cta = slide.querySelector('a');

    const cell = doc.createElement('div');

    if (img) {
      cell.appendChild(img.cloneNode(true));
    } else if (bgSrc) {
      const bg = doc.createElement('img');
      bg.src = bgSrc;
      bg.alt = heading?.textContent?.trim() || '';
      cell.appendChild(bg);
    }
    if (heading) cell.appendChild(heading.cloneNode(true));
    if (text) cell.appendChild(text.cloneNode(true));
    if (cta) cell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));

    rows.push([cell]);
  });

  if (rows.length > 0) carousel.replaceWith(block('Carousel', rows, doc));
}

// ---------------------------------------------------------------------------
// Hero Banner — single full-width banner with optional CTA
// Selectors: .hero, .cmp-teaser--hero, [class*="hero-banner"], .page-banner
// ---------------------------------------------------------------------------
function transformHero(main, doc) {
  const hero = main.querySelector(
    '.hero, .cmp-teaser--hero, [class*="hero-banner"], .our-brands-hero-banner, .page-banner, [class*="page-hero"]',
  );
  if (!hero) return;

  const img = hero.querySelector('img');
  const bgSrc = extractBgImage(hero) || extractBgImage(hero.querySelector('[style]'));
  const heading = hero.querySelector('h1, h2');
  const text = hero.querySelector('p');
  const cta = hero.querySelector('a');

  const mediaCell = doc.createElement('div');
  if (img) {
    mediaCell.appendChild(img.cloneNode(true));
  } else if (bgSrc) {
    const bg = doc.createElement('img');
    bg.src = bgSrc;
    bg.alt = heading?.textContent?.trim() || '';
    mediaCell.appendChild(bg);
  }

  const contentCell = doc.createElement('div');
  if (heading) contentCell.appendChild(heading.cloneNode(true));
  if (text) contentCell.appendChild(text.cloneNode(true));
  if (cta) contentCell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));

  const hasMedia = mediaCell.hasChildNodes();
  const hasContent = contentCell.hasChildNodes();
  let rows;
  if (hasMedia && hasContent) {
    rows = [[mediaCell, contentCell]];
  } else if (hasMedia) {
    rows = [[mediaCell]];
  } else {
    rows = [[contentCell]];
  }

  if (rows[0][0].hasChildNodes()) hero.replaceWith(block('Hero', rows, doc));
}

// ---------------------------------------------------------------------------
// Card Grid — 4-up cards (homepage, who-we-are, sustainability reports)
// Selectors: .card-grid, .cmp-container--cards, [class*="card-grid"]
// ---------------------------------------------------------------------------
function transformCards(main, doc) {
  const grids = main.querySelectorAll(
    '.card-grid, [class*="card-grid"], [class*="cards-container"], [class*="teaser-grid"]',
  );
  grids.forEach((grid) => {
    const cards = grid.querySelectorAll(
      '.card, .cmp-teaser, article.card, [class*="card-item"], [class*="teaser-item"]',
    );
    if (cards.length === 0) return;

    const rows = [];
    cards.forEach((card) => {
      const img = card.querySelector('img');
      const heading = card.querySelector('h3, h4, .card-title, .cmp-teaser__title');
      const desc = card.querySelector('p, .cmp-teaser__description');
      const cta = card.querySelector('a');

      const cell = doc.createElement('div');
      if (img) cell.appendChild(img.cloneNode(true));
      if (heading) cell.appendChild(heading.cloneNode(true));
      if (desc) cell.appendChild(desc.cloneNode(true));
      // Avoid duplicating the heading link as a CTA
      if (cta && cta !== heading?.querySelector('a') && cta.textContent.trim()) {
        cell.appendChild(primaryButton(doc, cta.href, cta.textContent.trim()));
      }
      rows.push([cell]);
    });

    if (rows.length > 0) grid.replaceWith(block('Cards', rows, doc));
  });
}

// ---------------------------------------------------------------------------
// Awards / Recognition Strip — custom block
// Selectors: [class*="awards"], [class*="recognition"], [class*="achievements"]
// ---------------------------------------------------------------------------
function transformAwards(main, doc) {
  const section = main.querySelector(
    '[class*="awards"], [class*="recognition"], [class*="achievements"], [class*="accolades"]',
  );
  if (!section) return;

  const heading = section.querySelector('h2, h3');
  const items = section.querySelectorAll(
    '[class*="award-item"], [class*="badge"], figure, [class*="logo-item"]',
  );

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

  if (rows.length > 0) section.replaceWith(block('Awards', rows, doc));
}

// ---------------------------------------------------------------------------
// Brand Cards — circular brand cards with category filter (Our Brands page)
// Selectors: [class*="brand-grid"], [class*="brands-list"]
// ---------------------------------------------------------------------------
function transformBrandCards(main, doc) {
  const brandGrid = main.querySelector(
    '[class*="brand-grid"], [class*="brands-list"], [class*="brand-list"]',
  );
  if (!brandGrid) return;

  const brands = brandGrid.querySelectorAll(
    '[class*="brand-card"], [class*="brand-item"], article',
  );
  if (brands.length === 0) return;

  const rows = [];
  brands.forEach((brand) => {
    const img = brand.querySelector('img');
    const name = brand.querySelector('h3, h4, p, [class*="brand-name"]');
    const category = brand.querySelector('[class*="category"], [class*="label"], [class*="tag"]');
    const link = brand.querySelector('a');

    const imgCell = doc.createElement('div');
    const contentCell = doc.createElement('div');

    if (img) imgCell.appendChild(img.cloneNode(true));
    if (name) contentCell.appendChild(name.cloneNode(true));
    if (category) contentCell.appendChild(category.cloneNode(true));
    if (link) {
      const ctaText = link.textContent.trim() || name?.textContent?.trim() || 'Learn more';
      contentCell.appendChild(primaryButton(doc, link.href, ctaText));
    }

    rows.push([imgCell, contentCell]);
  });

  if (rows.length > 0) brandGrid.replaceWith(block('Brand Cards', rows, doc));
}

// ---------------------------------------------------------------------------
// Columns — CEO message, core values, sustainability pillars, 2–3 col layouts
// Selectors: .cmp-container--columns, [class*="pillar"], [class*="three-col"]
// ---------------------------------------------------------------------------
function transformColumns(main, doc) {
  const containers = main.querySelectorAll(
    '.cmp-container--columns, [class*="columns-layout"], [class*="pillar-section"], [class*="three-col"], [class*="two-col"]',
  );
  containers.forEach((container) => {
    const cols = [...container.children].filter(
      (c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE',
    );
    if (cols.length < 2) return;

    const row = cols.map((col) => {
      const cell = doc.createElement('div');
      cell.innerHTML = col.innerHTML;
      return cell;
    });

    container.replaceWith(block('Columns', [row], doc));
  });
}

// ---------------------------------------------------------------------------
// Accordion — sustainability collapsible sections
// Selectors: .cmp-accordion, [class*="accordion"], details
// ---------------------------------------------------------------------------
function transformAccordion(main, doc) {
  main.querySelectorAll('details').forEach((details) => {
    const summary = details.querySelector('summary');
    const body = doc.createElement('div');
    [...details.children].forEach((c) => {
      if (c.tagName !== 'SUMMARY') body.appendChild(c.cloneNode(true));
    });
    details.replaceWith(
      block('Accordion', [[summary?.textContent?.trim() || '', body]], doc),
    );
  });

  main.querySelectorAll('.cmp-accordion, [class*="accordion-component"]').forEach((acc) => {
    const items = acc.querySelectorAll('.cmp-accordion__item, [class*="accordion-item"]');
    if (items.length === 0) return;

    const rows = [];
    items.forEach((item) => {
      const title = item.querySelector(
        '.cmp-accordion__header, [class*="accordion-title"], [class*="accordion-header"]',
      );
      const content = item.querySelector(
        '.cmp-accordion__panel, [class*="accordion-panel"], [class*="accordion-content"]',
      );
      const contentCell = doc.createElement('div');
      if (content) contentCell.innerHTML = content.innerHTML;
      rows.push([title?.textContent?.trim() || '', contentCell]);
    });

    if (rows.length > 0) acc.replaceWith(block('Accordion', rows, doc));
  });
}

// ---------------------------------------------------------------------------
// Video Embeds — YouTube, Vimeo, AEM cmp-video
// ---------------------------------------------------------------------------
function transformVideo(main, doc) {
  main.querySelectorAll(
    'iframe[src*="youtube"], iframe[src*="vimeo"], .cmp-video, [class*="video-embed"], [class*="video-container"]',
  ).forEach((el) => {
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
    el.replaceWith(block('Embed', [[p]], doc));
  });
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------
function transformBreadcrumbs(main, doc) {
  const bc = main.querySelector(
    '.cmp-breadcrumb, [aria-label="Breadcrumb"], [class*="breadcrumb"]',
  );
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
// Forms — scaffold as EDS Form block pointing to /forms/<id>
// ---------------------------------------------------------------------------
function transformForms(main, doc) {
  main.querySelectorAll('form').forEach((form) => {
    const formId = form.id || form.getAttribute('name') || 'contact';
    form.replaceWith(block('Form', [[`/forms/${formId}`]], doc));
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default {
  transform({ document: doc, url }) {
    cleanup(doc);
    const main = doc.querySelector('main') || doc.body;
    fixLinks(main, url);
    fixLazyImages(main);

    const path = new URL(url).pathname;

    // Run transformers in DOM order
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

    main.appendChild(wrapSection(buildMetadata(doc)));

    return [{
      element: main,
      path: path.replace(/\/$/, '') || '/index',
    }];
  },
};
