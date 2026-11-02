/**
 * 🏁 Muntrume Motorsport · team.js
 * Client-side driver filter and roster sorting
 */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const driversGrid = document.getElementById('driversGrid');
  const noResults = document.getElementById('noResults');

  if (!driversGrid) return;

  let currentSearch = '';
  let currentSort = 'roster';
  document.querySelectorAll('.driver-card').forEach((c, i) => { c.dataset.order = String(i); });

  function applyDriverFilters() {
    const cards = Array.from(document.querySelectorAll('.driver-card'));
    let visible = 0;

    cards.forEach(c => {
      const name = (c.dataset.name || '').toLowerCase();
      const matchSearch = !currentSearch || name.includes(currentSearch.toLowerCase());

      if (matchSearch) {
        c.classList.remove('hidden-card');
        visible++;
      } else {
        c.classList.add('hidden-card');
      }
    });

    if (noResults) {
      if (visible === 0) noResults.classList.remove('hidden');
      else noResults.classList.add('hidden');
    }

    applyDriverSorting();
  }

  function applyDriverSorting() {
    const visibleCards = Array.from(document.querySelectorAll('.driver-card:not(.hidden-card)'));
    const hiddenCards = Array.from(document.querySelectorAll('.driver-card.hidden-card'));

    visibleCards.sort((a, b) => {
      switch (currentSort) {
        case 'roster': return Number(a.dataset.order) - Number(b.dataset.order);
        case 'name-asc': return (a.dataset.name || '').localeCompare(b.dataset.name || '');
        default: return 0;
      }
    });

    visibleCards.forEach((c, i) => {
      const badge = c.querySelector('.rank-badge');
      if (badge) badge.textContent = `#${i + 1}`;
      driversGrid.appendChild(c);
    });
    hiddenCards.forEach(c => driversGrid.appendChild(c));
  }

  searchInput?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    applyDriverFilters();
  });

  sortSelect?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyDriverSorting();
  });
});
