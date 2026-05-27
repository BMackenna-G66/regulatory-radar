const Sources = (() => {
  const FREQ_COLOR = {
    'Semanal':   '#1e5fbc',
    'Quincenal': '#2d7ae8',
    'Mensual':   '#5a6880',
    'Diaria':    '#c0392b',
  };

  // Maps sources.json numeric ID → scraper key in sources_status.json
  const SOURCE_SCRAPER_KEY = {
    1:  'CMF',
    2:  'UAF',
    3:  'Banco Central de Chile',
    4:  'Diario Oficial',
    5:  'Congreso Nacional',
    6:  'Congreso Nacional',
    7:  'Congreso Nacional',
    8:  'SERNAC',
    9:  'Agencia de Datos',
    11: 'CMF',
    17: 'GAFI / GAFILAT',
    18: 'GAFI / GAFILAT',
    19: 'OFAC / GAFI',
  };

  let _status = {};

  async function _loadStatus() {
    try {
      const r = await fetch('./data/sources_status.json');
      if (r.ok) _status = await r.json();
    } catch (_) { _status = {}; }
  }

  function _getStatusEntry(sourceId) {
    const key = SOURCE_SCRAPER_KEY[sourceId];
    if (!key) return null;
    return _status[key] || null;
  }

  function _statusBadge(sourceId) {
    const s = _getStatusEntry(sourceId);
    if (!s) {
      return `<span class="badge" style="background:#f1f5f9;color:#94a3b8;font-size:.66rem;">Manual</span>`;
    }
    if (s.status === 'pending') {
      return `<span class="badge" style="background:#f1f5f9;color:#64748b;font-size:.66rem;">Pendiente</span>`;
    }
    if (s.status === 'error') {
      return `<span class="badge badge-critico" style="font-size:.66rem;" title="${s.error || 'Error'}">Error</span>`;
    }
    const newBadge = s.new_items_found > 0
      ? `<span class="badge badge-alto" style="font-size:.66rem;margin-left:4px;">+${s.new_items_found}</span>`
      : '';
    return `<span class="badge badge-implementado" style="font-size:.66rem;">OK</span>${newBadge}`;
  }

  function _lastChecked(sourceId) {
    const s = _getStatusEntry(sourceId);
    if (!s || !s.last_checked) return '<span style="color:#94a3b8;font-size:.72rem;">—</span>';
    const d = new Date(s.last_checked);
    const now = new Date();
    const diffH = Math.round((now - d) / 3600000);
    let label;
    if (diffH < 1) label = 'Hace &lt;1h';
    else if (diffH < 24) label = `Hace ${diffH}h`;
    else {
      const diffD = Math.floor(diffH / 24);
      label = diffD === 1 ? 'Ayer' : `Hace ${diffD}d`;
    }
    const full = d.toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<span style="font-size:.72rem;color:#5a6880;" title="${full}">${label}</span>`;
  }

  async function render() {
    await _loadStatus();

    const sources = Data.sources();
    const tbody   = document.getElementById('sources-tbody');
    const kpisEl  = document.getElementById('sources-kpis');
    if (!tbody) return;

    // KPIs
    const alta     = sources.filter(s => s.criticality === 'ALTA').length;
    const semanal  = sources.filter(s => s.review_frequency === 'Semanal').length;
    const okCount  = Object.values(_status).filter(s => s.status === 'ok').length;
    const errCount = Object.values(_status).filter(s => s.status === 'error').length;

    if (kpisEl) kpisEl.innerHTML = [
      { label: 'Total fuentes',    value: sources.length, cls: 'azul' },
      { label: 'Criticidad ALTA',  value: alta,           cls: 'critico' },
      { label: 'OK último escaneo',value: okCount,        cls: 'verde' },
      { label: 'Con errores',      value: errCount,       cls: errCount > 0 ? 'critico' : '' },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
      </div>`).join('');

    if (!sources.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:#94a3b8;">Sin fuentes disponibles</td></tr>';
      return;
    }

    tbody.innerHTML = sources.map(s => {
      const freqColor = FREQ_COLOR[s.review_frequency] || '#5a6880';
      const critCls   = s.criticality === 'ALTA' ? 'critico' : 'bajo';
      const urlDisplay = s.url
        ? `<a href="https://${s.url}" target="_blank" rel="noopener" style="font-size:.75rem;color:var(--blue);">${s.url}</a>`
        : '—';
      const hasAuto   = !!SOURCE_SCRAPER_KEY[s.id];
      const autoIcon  = hasAuto
        ? `<span title="Escaneo automático activo" style="color:#1a7a3e;font-size:.75rem;margin-left:4px;">⚙</span>`
        : `<span title="Revisión manual requerida" style="color:#94a3b8;font-size:.75rem;margin-left:4px;">👤</span>`;

      return `<tr>
        <td style="font-weight:600;font-size:.82rem;">${s.id}</td>
        <td>
          <div style="font-weight:600;font-size:.84rem;">${s.name || '—'}${autoIcon}</div>
          <div style="font-size:.72rem;color:#5a6880;">${s.institution || '—'}</div>
          <div style="margin-top:2px;">${urlDisplay}</div>
        </td>
        <td>
          <span style="font-weight:600;color:${freqColor};font-size:.82rem;">${s.review_frequency || '—'}</span>
        </td>
        <td style="font-size:.78rem;">${s.responsible_area || '—'}</td>
        <td><span class="badge badge-${critCls}" style="font-size:.68rem;">${s.criticality || '—'}</span></td>
        <td>${_statusBadge(s.id)}</td>
        <td>${_lastChecked(s.id)}</td>
        <td style="font-size:.75rem;color:#5a6880;max-width:200px;">${(s.comments || '').slice(0,100)}${s.comments && s.comments.length > 100 ? '…' : ''}</td>
      </tr>`;
    }).join('');
  }

  return { render };
})();
