const Categories = (() => {
  const RISK_COLOR = { 'ALTO': 'var(--critico)', 'MEDIO': 'var(--alto)', 'BAJO': 'var(--bajo)' };
  const PRIO_BADGE = {
    'INMEDIATA':    'critico',
    'CORTO PLAZO':  'alto',
    'MEDIANO PLAZO':'medio',
    'LARGO PLAZO':  'bajo',
  };

  function render() {
    const cats  = Data.categories();
    const items = Data.items();
    const grid  = document.getElementById('categories-grid');
    if (!grid) return;

    if (!cats.length) {
      grid.innerHTML = '<p style="color:#94a3b8;">Categorias no disponibles.</p>';
      return;
    }

    grid.innerHTML = cats.map(cat => {
      const riskColor = RISK_COLOR[cat.risk_level] || '#94a3b8';
      const prioBadge = PRIO_BADGE[cat.monitoring_priority] || 'bajo';
      const count = cat.norm_count ?? items.filter(i =>
        (i.regulated_subject || '').toLowerCase().includes((cat.name || '').toLowerCase().slice(0,4))
      ).length;

      return `<div class="category-card" onclick="App.navigate('inbox')">
        <div class="category-card-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="risk-indicator-lg" style="background:${riskColor};"></div>
            <div>
              <div class="category-name">${cat.name}</div>
              <div class="category-entity" style="font-size:.72rem;color:#5a6880;">${cat.entity_applicable || '—'}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.6rem;font-weight:700;color:${riskColor};">${count}</div>
            <div style="font-size:.68rem;color:#5a6880;">normas</div>
          </div>
        </div>
        <div style="font-size:.78rem;color:#5a6880;margin:8px 0;line-height:1.4;">${(cat.description || '').slice(0,120)}${cat.description && cat.description.length > 120 ? '…' : ''}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <span class="badge badge-${prioBadge}" style="font-size:.68rem;">${cat.monitoring_priority || '—'}</span>
          <span style="font-size:.72rem;color:#5a6880;">${cat.regulator || '—'}</span>
          <span style="font-size:.72rem;color:#5a6880;margin-left:auto;">${cat.responsible_area || '—'}</span>
        </div>
        ${cat.pending_bills ? `<div style="margin-top:6px;font-size:.7rem;padding:4px 8px;background:#fffbf2;border-left:3px solid #f59e0b;border-radius:3px;color:#92400e;">${cat.pending_bills.slice(0,80)}${cat.pending_bills.length > 80 ? '…' : ''}</div>` : ''}
      </div>`;
    }).join('');
  }

  return { render };
})();
