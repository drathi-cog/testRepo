/* global WebImporter */
/* eslint-disable no-console, no-restricted-syntax */

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
      if (cell == null) {
        td.innerHTML = '';
      } else if (cell.nodeType) {
        td.appendChild(cell);
      } else if (Array.isArray(cell)) {
        cell.forEach((c) => {
          if (c == null) return;
          if (c.nodeType) td.appendChild(c);
          else {
            const span = doc.createElement('span');
            span.innerHTML = String(c);
            td.appendChild(span);
          }
        });
      } else {
        td.innerHTML = String(cell);
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  return table;
}

function sectionBreak(doc) {
  return doc.createElement('hr');
}

function fixLazyImages(root) {
  root.querySelectorAll('img[data-src], img[data-lazy-src], img[data-original]').forEach((img) => {
    const src = img.dataset.src || img.dataset.lazySrc || img.dataset.original;
    if (src) img.src = src;
  });
  root.querySelectorAll('img[data-srcset]').forEach((img) => {
    img.srcset = img.dataset.srcset;
  });
}

function fixLinks(main, url) {
  const { origin, hostname } = new URL(url);
  main.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const abs = new URL(href, origin);
      a.href = abs.hostname === hostname
        ? abs.pathname + abs.search + abs.hash
        : abs.href;
    } catch (_) { /* leave malformed hrefs */ }
  });
  main.querySelectorAll('img[src]').forEach((img) => {
    try { img.src = new URL(img.getAttribute('src'), origin).href; } catch (_) { /* skip */ }
  });
}

// Pull the highest-resolution <source> from a <picture> and rewrite its <img> src.
// Tiffany's CDN serves several `resize-w:` variants — prefer the largest.
function upgradeImagesFromSources(root) {
  root.querySelectorAll('picture').forEach((picture) => {
    const img = picture.querySelector('img');
    if (!img) return;
    const sources = [...picture.querySelectorAll('source[srcset]')];
    if (!sources.length) return;
    let bestUrl = null;
    let bestWidth = 0;
    sources.forEach((s) => {
      const ss = s.getAttribute('srcset') || '';
      const first = ss.split(',')[0].trim().split(/\s+/)[0];
      const wMatch = first.match(/resize-w:(\d+)/);
      const w = wMatch ? parseInt(wMatch[1], 10) : 0;
      if (w > bestWidth) { bestWidth = w; bestUrl = first; }
      else if (!bestUrl) bestUrl = first;
    });
    if (bestUrl) img.src = bestUrl;
    img.removeAttribute('srcset');
    sources.forEach((s) => s.remove());
  });
}

// ---------------------------------------------------------------------------
// Cleanup — strip header, footer, dynamic widgets, scripts
// ---------------------------------------------------------------------------
function cleanup(doc) {
  WebImporter.DOMUtils.remove(doc, [
    'header',
    'nav',
    'footer',
    'script',
    'noscript',
    'style',
    'svg',
    // FDK / Fynd platform chrome
    '#fdk_default_header',
    '#fdk_default_footer',
    '.fdk-theme-footer',
    '#dy__header-navigation',
    '#dy__footer',
    '#dy__footer-links',
    '#dy__breadcrumb-section',
    '#dy__newsletter-mobile',
    // Dynamic Yield placeholders that are empty in SSR
    '#dy-tiffanyandco-rich-text',
    '#dy-tiffany-category-block',
    '#dy__logo-section',
    '#dy__homepage',
    // Recommendation slider — empty SSR shell, hydrated client-side
    '#recommendationSlider',
    '#feature-slide',
    '.slick-slider',
    // Generic widgets
    '[id*="cookie"]',
    '[class*="consent"]',
    '[class*="chat-widget"]',
    '#onetrust-consent-sdk',
  ]);
}

// ---------------------------------------------------------------------------
// Section transformers — each takes a section element and returns
// an array of nodes (heading + block table) to replace it with.
// ---------------------------------------------------------------------------

// Find the first picture/img in a node, return a clone wrapped in a fresh <picture>.
function pickHeroImage(section, doc) {
  const pic = section.querySelector('picture');
  if (pic) return pic.cloneNode(true);
  const img = section.querySelector('img');
  if (!img) return null;
  const newPic = doc.createElement('picture');
  newPic.appendChild(img.cloneNode(true));
  return newPic;
}

// Anchors inside the section that visually represent a "card" (wrap a picture).
function pickImageAnchors(section) {
  return [...section.querySelectorAll('a[href]')].filter((a) => a.querySelector('picture, img'));
}

// All text-only anchors (CTA links without images).
function pickTextAnchors(section) {
  return [...section.querySelectorAll('a[href]')].filter((a) => !a.querySelector('picture, img'));
}

function pickHeadings(section) {
  return [...section.querySelectorAll('h1, h2, h3')];
}

// Strong-wrap a link to mark it as a primary button (EDS button convention).
function asPrimaryButton(anchor, doc) {
  const p = doc.createElement('p');
  const strong = doc.createElement('strong');
  const a = doc.createElement('a');
  a.href = anchor.getAttribute('href');
  a.textContent = anchor.textContent.replace(/\s+/g, ' ').trim();
  strong.appendChild(a);
  p.appendChild(strong);
  return p;
}

// Hero: image + heading + optional CTA button.
function transformAsHero(section, doc) {
  const out = [];
  const cellChildren = [];

  const img = pickHeroImage(section, doc);
  if (img) cellChildren.push(img);

  pickHeadings(section).forEach((h) => {
    const clone = doc.createElement(h.tagName.toLowerCase());
    clone.textContent = h.textContent.replace(/\s+/g, ' ').trim();
    cellChildren.push(clone);
  });

  // CTA — prefer the last image-bearing anchor (the section often links the image to the destination)
  const imageAnchors = pickImageAnchors(section);
  const textAnchors = pickTextAnchors(section);
  const cta = textAnchors[0] || imageAnchors[0];
  if (cta) {
    const ctaText = cta.textContent.replace(/\s+/g, ' ').trim() || 'Learn More';
    const ctaLink = doc.createElement('a');
    ctaLink.href = cta.getAttribute('href');
    ctaLink.textContent = ctaText;
    cellChildren.push(asPrimaryButton(ctaLink, doc));
  }

  if (cellChildren.length === 0) return out;
  out.push(block('Hero', [[cellChildren]], doc));
  out.push(sectionBreak(doc));
  return out;
}

// Cards: each image-bearing anchor becomes a card row (image | body).
function transformAsCards(section, doc) {
  const out = [];

  // Section-level intro headings appear as default content above the block
  pickHeadings(section).forEach((h) => {
    const clone = doc.createElement(h.tagName.toLowerCase());
    clone.textContent = h.textContent.replace(/\s+/g, ' ').trim();
    out.push(clone);
  });

  const imageAnchors = pickImageAnchors(section);
  const rows = imageAnchors.map((a) => {
    const pic = a.querySelector('picture') || a.querySelector('img').parentElement;
    const picClone = pic.cloneNode(true);

    // Body cell: extract any text nodes / paragraphs inside the anchor, plus the link itself
    const bodyParts = [];
    const paragraphs = [...a.querySelectorAll('p')];
    if (paragraphs.length > 0) {
      // Use the actual <p> structure from the source (title + description)
      paragraphs.forEach((p) => {
        const pClone = doc.createElement('p');
        pClone.textContent = p.textContent.replace(/\s+/g, ' ').trim();
        if (pClone.textContent) bodyParts.push(pClone);
      });
      // Add the anchor as a CTA link
      const span = a.querySelector('span');
      const ctaText = (span && span.textContent.trim()) || 'Learn More';
      const ctaP = doc.createElement('p');
      const ctaLink = doc.createElement('a');
      ctaLink.href = a.getAttribute('href');
      ctaLink.textContent = ctaText;
      ctaP.appendChild(ctaLink);
      bodyParts.push(ctaP);
    } else {
      // Simple label-style card: wrap text in an anchor
      const label = a.textContent.replace(/\s+/g, ' ').trim();
      const p = doc.createElement('p');
      const link = doc.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = label || 'Learn More';
      p.appendChild(link);
      bodyParts.push(p);
    }

    return [picClone, bodyParts];
  });

  if (rows.length === 0) return out;
  out.push(block('Cards', rows, doc));
  out.push(sectionBreak(doc));
  return out;
}

// Columns: exactly two image-bearing anchors → two-column block.
function transformAsColumns(section, doc) {
  const out = [];
  const imageAnchors = pickImageAnchors(section);
  const cells = imageAnchors.map((a) => {
    const pic = a.querySelector('picture') || a.querySelector('img').parentElement;
    const picClone = pic.cloneNode(true);
    const label = a.textContent.replace(/\s+/g, ' ').trim();

    // The Tiffany pattern is "<Collection Name>Shop Now" — split if it ends with Shop Now / similar CTA
    let title = label;
    let cta = 'Shop Now';
    const ctaMatch = label.match(/^(.+?)(Shop Now|Explore|Learn More|Discover)$/i);
    if (ctaMatch) { title = ctaMatch[1].trim(); cta = ctaMatch[2].trim(); }

    const heading = doc.createElement('h2');
    heading.textContent = title;

    const ctaP = doc.createElement('p');
    const ctaLink = doc.createElement('a');
    ctaLink.href = a.getAttribute('href');
    ctaLink.textContent = cta;
    ctaP.appendChild(ctaLink);

    return [picClone, heading, asPrimaryButton(ctaLink, doc)];
  });

  if (cells.length < 2) return out;
  // Single row, N columns
  out.push(block('Columns', [cells], doc));
  out.push(sectionBreak(doc));
  return out;
}

// Decide which transformer to run based on the section's content shape.
function classifySection(section) {
  const imageAnchors = pickImageAnchors(section);
  if (imageAnchors.length >= 3) return 'cards';
  if (imageAnchors.length === 2) {
    // Two image-anchors but headings present in only one → hero with secondary link
    return 'columns';
  }
  return 'hero';
}

function transformSections(main, doc) {
  const sections = [...main.querySelectorAll('[id^="section_"]')];
  sections.forEach((section) => {
    const type = classifySection(section);
    let replacement = [];
    if (type === 'cards') replacement = transformAsCards(section, doc);
    else if (type === 'columns') replacement = transformAsColumns(section, doc);
    else replacement = transformAsHero(section, doc);

    if (replacement.length === 0) {
      section.remove();
      return;
    }
    const frag = doc.createDocumentFragment();
    replacement.forEach((node) => frag.appendChild(node));
    section.replaceWith(frag);
  });
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
function buildMetadata(doc) {
  const meta = {};

  const title = doc.querySelector('title');
  if (title) meta.Title = title.textContent.replace(/\s+/g, ' ').trim();

  const desc = doc.querySelector('meta[name="description"]');
  if (desc) meta.Description = desc.getAttribute('content');

  const keywords = doc.querySelector('meta[name="keywords"]');
  if (keywords) meta.Keywords = keywords.getAttribute('content');

  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) meta['Canonical URL'] = canonical.getAttribute('href');

  const ogImg = doc.querySelector('meta[property="og:image"]');
  if (ogImg) {
    const img = doc.createElement('img');
    img.src = ogImg.getAttribute('content');
    meta.Image = img;
  }

  const ogType = doc.querySelector('meta[property="og:type"]');
  if (ogType) meta['OG Type'] = ogType.getAttribute('content');

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) meta['OG Title'] = ogTitle.getAttribute('content');

  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) meta['OG Description'] = ogDesc.getAttribute('content');

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

  return block('Metadata', Object.entries(meta).map(([k, v]) => [k, v ?? '']), doc);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default {
  transform({ document: doc, url }) {
    cleanup(doc);

    // Tiffany page content lives inside the FDK theme wrapper, not <main>.
    // Pick the largest container that holds the section_* divs.
    const sectionParent = doc.querySelector('[id^="section_"]')?.parentElement;
    const main = sectionParent || doc.querySelector('main') || doc.body;

    fixLazyImages(main);
    upgradeImagesFromSources(main);
    fixLinks(main, url);

    transformSections(main, doc);

    main.appendChild(buildMetadata(doc));

    return [{
      element: main,
      path: new URL(url).pathname.replace(/\/$/, '') || '/index',
    }];
  },
};
