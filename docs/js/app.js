/**
 * App router + init
 */
const App = (() => {
  const PAGES = {
    dashboard: { title: 'Dashboard Ejecutivo',   render: () => Dashboard.render() },
    inbox:     { title: 'Bandeja de Revisión',   render: () => Inbox.render() },
    detail:    { title: 'Detalle de Normativa',  render: () => {} },
    tracking:  { title: 'Seguimiento',           render: () => Tracking.render() },
    export:    { title: 'Exportar Bitácora',     render: () => Export.updatePreview() },
  };

  let _current = 'dashboard';

  function navigate(page) {
    if (!PAGES[page]) return;
    _current = page;

    // Show/hide pages
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.style.display = '';

    // Update nav
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });

    // Update topbar title
    document.getElementById('page-title').textContent = PAGES[page].title;

    // Update URL hash
    history.replaceState(null, '', `#${page}`);

    PAGES[page].render();
  }

  function navigateDetail(itemId) {
    navigate('detail');
    Detail.render(itemId);
  }

  function reload() {
    const loader = document.getElementById('global-loader');
    loader.style.display = '';
    Data.load().then(() => {
      loader.style.display = 'none';
      document.getElementById('last-updated').textContent = `Actualizado: ${new Date().toLocaleTimeString('es-CL')}`;
      navigate(_current);
    });
  }

  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  async function init() {
    // Wire nav clicks
    document.querySelectorAll('.nav-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(a.dataset.page);
      });
    });

    // Load data
    await Data.load();
    document.getElementById('global-loader').style.display = 'none';
    document.getElementById('last-updated').textContent = `Actualizado: ${new Date().toLocaleTimeString('es-CL')}`;

    // Route from hash or default
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(PAGES[hash] ? hash : 'dashboard');
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (PAGES[hash] && hash !== 'detail') navigate(hash);
  });

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, navigateDetail, reload, toast };
})();
