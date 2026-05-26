/**
 * Inbox / Bandeja de revisión
 */
const Inbox = (() => {
  const STATUS_LABEL = {
    nuevo:'Nuevo', en_revision:'En revisión',
    aplica_requiere_accion:'Aplica (acción)', aplica_informativo:'Aplica (info)',
    no_aplica:'No aplica', implementado:'Implementado', vencido:'Vencido',
  };

  function render() {
    const search  = document.getElementById('filter-search')?.value   || '';
    const country = document.getElementById('filter-country')?.value  || '';
    const status  = document.getElementById('filter-status')?.value   || '';
    const risk    = document.getElementById('filter-risk')?.value     || '';

    const rows = Data.enriched({ search, country, status, risk });
    const tbody = document.getElementById('inbox-tbody');
    const counter = document.getElementById('inbox-count');
    if (counter) counter.textContent = `${rows.length} norma${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:#94a3b8;">
        Sin resultados con los filtros actuales
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr onclick="App.navigateDetail(${r.id})" title="${r.title}">
        <td style="white-space:nowrap;">${r.publication_date || r.detected_at?.slice(0,10) || '—'}</td>
        <td>${r.country}</td>
        <td style="max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.regulator}</td>
        <td style="white-space:nowrap;">${r.document_type || '—'}</td>
        <td style="max-width:320px;">
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.title}</div>
        </td>
        <td>
          ${r.risk_score != null ? `
            <div style="font-weight:600;font-size:.85rem;">${r.risk_score}</div>
            <div class="score-bar" style="width:60px;">
              <div class="score-fill" style="width:${r.risk_score}%;background:${_scoreColor(r.risk_score)};"></div>
            </div>` : '—'}
        </td>
        <td>${r.risk_level ? `<span class="badge badge-${r.risk_level}">${r.risk_level}</span>` : '—'}</td>
        <td style="white-space:nowrap;">${r.thematic_classification || '—'}</td>
        <td><span class="badge badge-${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();App.navigateDetail(${r.id})">Ver →</button></td>
      </tr>`).join('');
  }

  function _scoreColor(score) {
    if (score >= 81) return '#dc2626';
    if (score >= 61) return '#d97706';
    if (score >= 31) return '#ca8a04';
    return '#16a34a';
  }

  return { render };
})();
