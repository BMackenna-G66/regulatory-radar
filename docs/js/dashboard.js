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
      { label: 'Total normativas',  value: s.total,        sub: 'en el repositorio',      cls: 'azul' },
      { label: 'Nuevas',            value: s.nuevo,        sub: 'pendientes de revision',  cls: '' },
      { label: 'Aplicables',        value: s.applicable,   sub: 'requieren seguimiento',   cls: 'verde' },
      { label: 'En revision',       value: s.en_revision,  sub: 'consultas publicas',      cls: '' },
      { label: 'Riesgo critico',    value: s.critical,     sub: 'score >= 81',             cls: 'critico' },
      { label: 'Por vencer',        value: s.expiring_soon, sub: 'proximos 7 dias',        cls: s.expiring_soon > 0 ? 'alto' : '' },
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

    // Regulator bar (horizontal)
    const regEntries = Object.entries(s.byRegulator).slice(0, 9);
    const rc = document.getElementById('chart-regulator').getContext('2d');
    _charts.regulator = new Chart(rc, {
      type: 'bar',
      data: {
        labels: regEntries.map(([k]) => k.length > 30 ? k.slice(0, 28) + '…' : k),
        datasets: [{
          data: regEntries.map(([, v]) => v),
          backgroundColor: BLUE_PALETTE,
          borderRadius: 4,
          borderSkipped: false,
        }],
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

    // Category doughnut
    const catEntries = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
    const cc = document.getElementById('chart-category').getContext('2d');
    _charts.category = new Chart(cc, {
      type: 'doughnut',
      data: {
        labels: catEntries.map(([k]) => k),
        datasets: [{
          data: catEntries.map(([, v]) => v),
          backgroundColor: BLUE_PALETTE,
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        cutout: '58%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, color: '#5a6880', boxWidth: 12 } },
        },
      },
    });

    // Doc type bar (horizontal)
    const dtEntries = Object.entries(s.byDocType).sort((a, b) => b[1] - a[1]);
    const dc = document.getElementById('chart-doctype').getContext('2d');
    _charts.doctype = new Chart(dc, {
      type: 'bar',
      data: {
        labels: dtEntries.map(([k]) => k),
        datasets: [{
          data: dtEntries.map(([, v]) => v),
          backgroundColor: '#2d7ae8',
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
  }

  function _destroyAll() {
    Object.values(_charts).forEach(c => c?.destroy?.());
    _charts = {};
  }

  return { render };
})();
