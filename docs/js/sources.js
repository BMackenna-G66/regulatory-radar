const Sources = (() => {
  const FREQ_COLOR = {
    'Semanal':   '#1e5fbc',
    'Quincenal': '#2d7ae8',
    'Mensual':   '#5a6880',
    'Diaria':    '#c0392b',
  };

  function render() {
    const sources = Data.sources();
    const tbody   = document.getElementById('sources-tbody');
    const kpisEl  = document.getElementById('sources-kpis');
    if (!tbody) return;

    // KPIs
    const alta   = sources.filter(s => s.criticality === 'ALTA').length;
    const semanal = sources.filter(s => s.review_frequency === 'Semanal').length;
    const diaria  = sources.filter(s => s.review_frequency === 'Diaria').length;
    if (kpisEl) kpisEl.innerHTML = [
      { label: 'Total fuentes',      value: sources.length, cls: 'azul' },
      { label: 'Criticidad ALTA',    value: alta,           cls: 'critico' },
      { label: 'Revision semanal',   value: semanal,        cls: '' },
      { label: 'Revision diaria',    value: diaria,         cls: 'alto' },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
      </div>`).join('');

    if (!sources.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#94a3b8;">Sin fuentes disponibles</td></tr>';
      return;
    }

    tbody.innerHTML = sources.map(s => {
      const freqColor = FREQ_COLOR[s.review_frequency] || '#5a6880';
      const critCls   = s.criticality === 'ALTA' ? 'critico' : 'bajo';
      const urlDisplay = s.url ? `<a href="https://${s.url}" target="_blank" rel="noopener" style="font-size:.75rem;color:var(--blue);">${s.url}</a>` : '—';

      return `<tr>
        <td style="font-weight:600;font-size:.82rem;">${s.id}</td>
        <td>
          <div style="font-weight:600;font-size:.84rem;">${s.name || '—'}</div>
          <div style="font-size:.72rem;color:#5a6880;">${s.institution || '—'}</div>
          <div style="margin-top:2px;">${urlDisplay}</div>
        </td>
        <td>
          <span style="font-weight:600;color:${freqColor};font-size:.82rem;">${s.review_frequency || '—'}</span>
        </td>
        <td style="font-size:.78rem;">${s.responsible_area || '—'}</td>
        <td><span class="badge badge-${critCls}" style="font-size:.68rem;">${s.criticality || '—'}</span></td>
        <td style="font-size:.75rem;color:#5a6880;max-width:260px;">${(s.comments || '').slice(0, 120)}${s.comments && s.comments.length > 120 ? '…' : ''}</td>
      </tr>`;
    }).join('');
  }

  return { render };
})();
