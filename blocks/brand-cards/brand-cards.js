import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  // Build filter buttons from unique category labels found in cards
  const categories = new Set();
  const cards = [...block.children];

  cards.forEach((card) => {
    card.classList.add('brand-cards-card');
    const [imgCell, contentCell] = [...card.children];
    if (imgCell) imgCell.classList.add('brand-cards-logo');
    if (contentCell) {
      contentCell.classList.add('brand-cards-content');
      const categoryEl = contentCell.querySelector('[class*="category"], [class*="label"], [class*="tag"], p:nth-child(2)');
      if (categoryEl) {
        const cat = categoryEl.textContent.trim();
        if (cat) categories.add(cat);
        categoryEl.setAttribute('data-category', cat);
        card.setAttribute('data-category', cat);
      }
    }
  });

  // Inject filter bar only when multiple categories exist
  if (categories.size > 1) {
    const filterBar = document.createElement('div');
    filterBar.classList.add('brand-cards-filters');

    const allBtn = document.createElement('button');
    allBtn.textContent = 'All';
    allBtn.classList.add('brand-cards-filter', 'brand-cards-filter--active');
    allBtn.setAttribute('data-filter', 'all');
    filterBar.appendChild(allBtn);

    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.textContent = cat;
      btn.classList.add('brand-cards-filter');
      btn.setAttribute('data-filter', cat);
      filterBar.appendChild(btn);
    });

    block.insertAdjacentElement('beforebegin', filterBar);

    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.brand-cards-filter');
      if (!btn) return;
      const filter = btn.getAttribute('data-filter');

      filterBar.querySelectorAll('.brand-cards-filter').forEach((b) => b.classList.remove('brand-cards-filter--active'));
      btn.classList.add('brand-cards-filter--active');

      cards.forEach((card) => {
        const cat = card.getAttribute('data-category') || '';
        card.hidden = filter !== 'all' && cat !== filter;
      });
    });
  }

  block.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]),
    );
  });
}
