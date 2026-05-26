const Inbox = (() => {
  const STATUS_LABEL = {
    nuevo:                  'Nuevo',
    en_revision:            'En revision',
    aplica_requiere_accion: 'Aplica — Accion',
    aplica_informativo:     'Aplica — Info',
    no_aplica:              'No aplica',
    implementado:           'Implementado',
    vencido:                'Vencido',
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

    const search    = document.getElementById('filter-search')?.value   || '';
    const regulator = document.getElementById('filter-regulator')?.value || '';
    const doctype   = document.getElementById('filter-doctype')?.value   || '';
    const status    = document.getElementById('filter-status')?.value   || '';
    const risk      = document.getElementById('filter-risk')?.value     || '';

    const rows = Data.enriched({ search, regulator, doctype, status, risk });
    const tbody   = document.getElementById('inbox-tbody');
    const counter = document.getElementById('inbox-count');
    if (counter) counter.textContent = `${rows.length} norma${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">
        Sin resultados con los filtros seleccionados
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const scoreColor = _scoreColor(r.risk_score);
      const riskDot = r.risk_level
        ? `<div class="risk-indicator">
             <div class="risk-dot ${r.risk_level}"></div>
             <span>${r.risk_level}</span>
           </div>`
        : '—';

      return `<tr onclick="App.navigateDetail(${r.id})" title="${r.title}">
        <td style="white-space:nowrap;font-size:.78rem;">${r.publication_date || r.detected_at?.slice(0,10) || '—'}</td>
        <td style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem;" title="${r.regulator}">${r.regulator}</td>
        <td style="white-space:nowrap;">
          <span style="font-size:.72rem;color:#5a6880;">${r.document_type || '—'}</span>
        </td>
        <td style="max-width:340px;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;">${r.title}</div>
        </td>
        <td>
          ${r.risk_score != null ? `
            <div style="font-weight:700;font-size:.85rem;color:${scoreColor};">${r.risk_score}</div>
            <div class="score-bar" style="width:52px;">
              <div class="score-fill" style="width:${r.risk_score}%;background:${scoreColor};"></div>
            </div>` : '—'}
        </td>
        <td>${riskDot}</td>
        <td style="font-size:.78rem;">${r.thematic_classification || '—'}</td>
        <td><span class="badge badge-${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
        <td>
          <button class="btn btn-outline-blue btn-sm"
            onclick="event.stopPropagation();App.navigateDetail(${r.id})">Ver</button>
        </td>
      </tr>`;
    }).join('');
  }

  function _scoreColor(score) {
    if (score >= 81) return 'var(--critico)';
    if (score >= 61) return 'var(--alto)';
    if (score >= 31) return 'var(--medio)';
    return 'var(--bajo)';
  }

  return { render, populateFilters };
})();
