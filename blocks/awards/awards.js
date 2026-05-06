import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const rows = [...block.children];

  // First row may be a single-cell heading
  const [firstRow] = rows;
  if (firstRow?.children.length === 1 && firstRow.querySelector('h2, h3')) {
    firstRow.classList.add('awards-heading');
  }

  rows.slice(firstRow?.classList.contains('awards-heading') ? 1 : 0).forEach((row) => {
    const [logoCell, captionCell] = [...row.children];
    if (logoCell) logoCell.classList.add('awards-logo');
    if (captionCell) captionCell.classList.add('awards-caption');
  });

  block.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '120' }]),
    );
  });
}
