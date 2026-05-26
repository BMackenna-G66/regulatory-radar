/**
 * Dashboard view – KPIs + Charts
 */
const Dashboard = (() => {
  let _charts = {};

  const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

  function render() {
    const s = Data.stats();
    _renderKPIs(s);
    _renderCharts(s);
  }

  function _renderKPIs(s) {
    const grid = document.getElementById('kpi-grid');
    const today = new Date().toISOString().slice(0,10);
    const kpis = [
      { label: 'Total detectadas', value: s.total,         sub: 'normas',                      cls: '' },
      { label: '🆕 Nuevas',        value: s.nuevo,         sub: 'pendientes revisión',          cls: '' },
      { label: '✅ Aplicables',    value: s.applicable,    sub: 'requieren seguimiento',        cls: 'verde' },
      { label: '🔴 Críticas',      value: s.critical,      sub: 'riesgo crítico',               cls: 'critico' },
      { label: '💀 Vencidas',      value: s.expired,       sub: 'fuera de plazo',               cls: 'alto' },
      { label: '⏰ Por vencer',    value: s.expiring_soon, sub: 'próximos 7 días',              cls: s.expiring_soon > 0 ? 'alto' : '' },
    ];
    grid.innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`).join('');
  }

  function _renderCharts(s) {
    _destroyAll();

    // Country pie
    const cc = document.getElementById('chart-country').getContext('2d');
    _charts.country = new Chart(cc, {
      type: 'doughnut',
      data: {
        labels: Object.keys(s.byCountry),
        datasets: [{ data: Object.values(s.byCountry), backgroundColor: PALETTE, borderWidth: 2 }],
      },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '55%' },
    });

    // Regulator bar
    const rc = document.getElementById('chart-regulator').getContext('2d');
    const regEntries = Object.entries(s.byRegulator);
    _charts.regulator = new Chart(rc, {
      type: 'bar',
      data: {
        labels: regEntries.map(([k]) => k.length > 28 ? k.slice(0,26)+'…' : k),
        datasets: [{ data: regEntries.map(([,v]) => v), backgroundColor: '#3b82f6', borderRadius: 4 }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { ticks: { font: { size: 11 } } } },
      },
    });

    // Category bar
    const catEntries = Object.entries(s.byCategory).sort((a,b) => b[1]-a[1]);
    const catc = document.getElementById('chart-category').getContext('2d');
    _charts.category = new Chart(catc, {
      type: 'bar',
      data: {
        labels: catEntries.map(([k]) => k),
        datasets: [{ data: catEntries.map(([,v]) => v), backgroundColor: PALETTE, borderRadius: 4 }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function _destroyAll() {
    Object.values(_charts).forEach(c => c?.destroy?.());
    _charts = {};
  }

  return { render };
})();
