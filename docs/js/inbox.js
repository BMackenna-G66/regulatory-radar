const Inbox = (() => {
  const IMPL_BADGE = {
    'Implementado': 'implementado',
    'En Proceso':   'aplica_requiere_accion',
    'Pendiente':    'nuevo',
    'N/A':          'no_aplica',
  };

  function populateFilters() {
    const items = Data.items();
    const regulators = [...new Set(items.map(i => i.regulator))].sort();
    const doctypes   = [...new Set(items.map(i => i.document_type).filter(Boolean))].sort();

    const selReg = document.getElementById('filter-regulator');
    const selDoc = document.getElementById('filter-doctype');
    if (!selReg || !selDoc) return;

    const currentReg = selReg.value;
    const currentDoc = selDoc.value;

    selReg.innerHTML = '<option value="">Todos los reguladores</option>' +
      regulators.map(r => `<option ${r === currentReg ? 'selected' : ''}>${r}</option>`).join('');
    selDoc.innerHTML = '<option value="">Todos los tipos</option>' +
      doctypes.map(d => `<option ${d === currentDoc ? 'selected' : ''}>${d}</option>`).join('');
  }

  function render() {
    populateFilters();

    const search    = document.getElementById('filter-search')?.value    || '';
    const entity    = document.getElementById('filter-entity')?.value    || '';
    const regulator = document.getElementById('filter-regulator')?.value || '';
    const doctype   = document.getElementById('filter-doctype')?.value   || '';
    const risk      = document.getElementById('filter-risk')?.value      || '';
    const impl      = document.getElementById('filter-impl')?.value      || '';

    const rows   = Data.enriched({ search, entity: entity || undefined, regulator, doctype, risk, impl: impl || undefined });
    const tbody  = document.getElementById('inbox-tbody');
    const counter = document.getElementById('inbox-count');
    if (counter) counter.textContent = `${rows.length} norma${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">Sin resultados con los filtros seleccionados</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const implCls  = IMPL_BADGE[r.implementation_status] || 'nuevo';
      const riskCls  = r.risk_consolidated === 'ALTO' ? 'critico' : r.risk_consolidated === 'MEDIO' ? 'alto' : 'bajo';
      const entityBadge = r.entity_applicable === 'Ambas'
        ? '<span class="badge" style="background:#e8f0fd;color:#1e5fbc;font-size:.68rem;">Ambas</span>'
        : r.entity_applicable === 'Global Card S.A.'
          ? '<span class="badge" style="background:#dff5ec;color:#1a7a3e;font-size:.68rem;">GC</span>'
          : '<span class="badge" style="background:#fff7e6;color:#92400e;font-size:.68rem;">G81</span>';

      return `<tr onclick="App.navigateDetail(${r.id})" title="${r.title}">
        <td style="white-space:nowrap;font-size:.78rem;">${r.publication_date || r.detected_at?.slice(0,10) || '—'}</td>
        <td style="max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem;" title="${r.regulator}">${r.regulator}</td>
        <td style="white-space:nowrap;font-size:.72rem;color:#5a6880;">${r.document_type || '—'}</td>
        <td style="max-width:300px;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;" title="${r.identifier || ''}">${r.title}</div>
          <div style="font-size:.7rem;color:#5a6880;">${r.identifier || ''}</div>
        </td>
        <td>
          <span class="badge badge-${riskCls}" style="font-size:.7rem;">${r.risk_consolidated || '—'}</span>
        </td>
        <td>${entityBadge}</td>
        <td><span class="badge badge-${implCls}" style="font-size:.7rem;">${r.implementation_status || '—'}</span></td>
        <td>
          <button class="btn btn-outline-blue btn-sm" onclick="event.stopPropagation();App.navigateDetail(${r.id})">Ver</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Wire filter changes
  document.addEventListener('input', e => {
    if (e.target.id === 'filter-search') render();
  });
  document.addEventListener('change', e => {
    const ids = ['filter-entity','filter-regulator','filter-doctype','filter-risk','filter-impl'];
    if (ids.includes(e.target.id)) render();
  });

  return { render, populateFilters };
})();
