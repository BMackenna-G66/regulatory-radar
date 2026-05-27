const Dashboard = (() => {
  let _charts = {};

  const BLUE_PALETTE = [
    '#1e5fbc','#2d7ae8','#4a9df5','#6db4f7','#90c9f9',
    '#b3dcfb','#c6387a','#e05c96','#8b5cf6','#a78bfa',
  ];

  function render() {
    const s = Data.stats();
    _renderKPIs(s);
    _renderCharts(s);
  }

  function _renderKPIs(s) {
    const grid = document.getElementById('kpi-grid');
    const kpis = [
      { label: 'Total normativas',    value: s.total,        sub: 'en el normograma',         cls: 'azul' },
      { label: 'Riesgo ALTO',         value: s.critical,     sub: `${Math.round(s.critical/s.total*100)}% del total`, cls: 'critico' },
      { label: 'Implementado',        value: s.implementado, sub: 'estado final',              cls: 'verde' },
      { label: 'En proceso',          value: s.en_proceso,   sub: 'requieren seguimiento',     cls: '' },
      { label: 'Nuevas / Pendientes', value: s.nuevo,        sub: 'pendientes de revision',    cls: '' },
      { label: 'Por vencer',          value: s.expiring_soon,sub: 'proximos 7 dias',           cls: s.expiring_soon > 0 ? 'alto' : '' },
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

    const regEntries = Object.entries(s.byRegulator).slice(0, 10);
    const rc = document.getElementById('chart-regulator').getContext('2d');
    _charts.regulator = new Chart(rc, {
      type: 'bar',
      data: {
        labels: regEntries.map(([k]) => k.length > 28 ? k.slice(0, 26) + '…' : k),
        datasets: [{ data: regEntries.map(([, v]) => v), backgroundColor: BLUE_PALETTE, borderRadius: 4, borderSkipped: false }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, color: '#5a6880' }, grid: { color: '#eef1f5' } },
          y: { ticks: { font: { size: 11 }, color: '#5a6880' }, grid: { display: false } },
        },
      },
    });

    const catEntries = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const cc = document.getElementById('chart-category').getContext('2d');
    _charts.category = new Chart(cc, {
      type: 'doughnut',
      data: {
        labels: catEntries.map(([k]) => k),
        datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: BLUE_PALETTE, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        cutout: '55%',
        plugins: { legend: { position: 'right', labels: { font: { size: 10 }, color: '#5a6880', boxWidth: 10 } } },
      },
    });

    const implEntries = Object.entries(s.byImplStatus).sort((a, b) => b[1] - a[1]);
    const IMPL_COLORS = { 'Implementado': '#1a7a3e', 'En Proceso': '#6d28d9', 'Pendiente': '#c87a00', 'N/A': '#94a3b8' };
    const ic = document.getElementById('chart-impl-status').getContext('2d');
    _charts.implStatus = new Chart(ic, {
      type: 'bar',
      data: {
        labels: implEntries.map(([k]) => k),
        datasets: [{
          data: implEntries.map(([, v]) => v),
          backgroundColor: implEntries.map(([k]) => IMPL_COLORS[k] || '#2d7ae8'),
          borderRadius: 4,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: '#5a6880' }, grid: { color: '#eef1f5' } },
          x: { ticks: { color: '#5a6880', font: { size: 11 } }, grid: { display: false } },
        },
      },
    });

    const entEntries = Object.entries(s.byEntity);
    const ENTITY_COLORS = ['#1e5fbc', '#01b07a', '#f59e0b'];
    const ec = document.getElementById('chart-entity').getContext('2d');
    _charts.entity = new Chart(ec, {
      type: 'doughnut',
      data: {
        labels: entEntries.map(([k]) => k),
        datasets: [{ data: entEntries.map(([, v]) => v), backgroundColor: ENTITY_COLORS, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        cutout: '55%',
        plugins: { legend: { position: 'right', labels: { font: { size: 11 }, color: '#5a6880', boxWidth: 10 } } },
      },
    });
  }

  function _destroyAll() {
    Object.values(_charts).forEach(c => c?.destroy?.());
    _charts = {};
  }

  return { render };
})();
