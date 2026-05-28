const App = (() => {
  const PAGES = {
    dashboard:  { title: 'Dashboard Ejecutivo',            render: () => Dashboard.render() },
    inbox:      { title: 'Normativas',                     render: () => Inbox.render() },
    detail:     { title: 'Detalle de Normativa',           render: () => {} },
    categories: { title: 'Categorias Normativas',          render: () => Categories.render() },
    sources:    { title: 'Mapa de Fuentes Regulatorias',   render: () => Sources.render() },
    tracking:   { title: 'Seguimiento de Implementacion',  render: () => Tracking.render() },
    changes:    { title: 'Registro de Cambios Normativos', render: () => Changes.render() },
    alerts:     { title: 'Alertas Regulatorias',           render: () => Alerts.render() },
    report:     { title: 'Reporte Mensual — Comites',      render: () => Report.render() },
    export:     { title: 'Exportar Bitacora',              render: () => Export.updatePreview() },
  };

  let _current = 'dashboard';

  function navigate(page) {
    if (!PAGES[page]) return;
    _current = page;

    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.style.display = '';

    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });

    document.getElementById('page-title').textContent = PAGES[page].title;
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
      document.getElementById('last-updated').textContent =
        `Actualizado: ${new Date().toLocaleTimeString('es-CL')}`;
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
    document.querySelectorAll('.nav-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        navigate(a.dataset.page);
      });
    });

    await Data.load();
    document.getElementById('global-loader').style.display = 'none';
    document.getElementById('last-updated').textContent =
      `Actualizado: ${new Date().toLocaleTimeString('es-CL')}`;

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(PAGES[hash] ? hash : 'dashboard');

    // Check GitHub Actions status on load (silencioso si no está configurado)
    GitHub.init();
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (PAGES[hash] && hash !== 'detail') navigate(hash);
  });

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, navigateDetail, reload, toast };
})();
