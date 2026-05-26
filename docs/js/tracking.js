const Tracking = (() => {
  const KEY = 'rr_tracking_v1';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }
  function _save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  function get(itemId) { return _load()[String(itemId)] || null; }

  function set(itemId, record) {
    const data = _load();
    data[String(itemId)] = { ...record, item_id: itemId, last_update: new Date().toISOString() };
    _save(data);
  }

  function all() { return Object.values(_load()); }

  const STATUSES = [
    { id: 'pendiente_revision', label: 'Pendiente',        color: '#c87a00' },
    { id: 'asignado',           label: 'Asignado',         color: '#1e5fbc' },
    { id: 'en_implementacion',  label: 'En implementacion',color: '#6d28d9' },
    { id: 'bloqueado',          label: 'Bloqueado',        color: '#c0392b' },
    { id: 'implementado',       label: 'Implementado',     color: '#1a7a3e' },
    { id: 'cerrado',            label: 'Cerrado',          color: '#5a6880' },
  ];

  const PROGRESS_LABEL = Object.fromEntries(STATUSES.map(s => [s.id, s.label]));

  let _view = 'kanban';

  function setView(v) {
    _view = v;
    document.getElementById('tracking-kanban').style.display = v === 'kanban' ? '' : 'none';
    document.getElementById('tracking-table').style.display  = v === 'table'  ? '' : 'none';
    document.getElementById('btn-kanban').className = 'btn btn-sm ' + (v === 'kanban' ? 'btn-primary' : 'btn-secondary');
    document.getElementById('btn-table').className  = 'btn btn-sm ' + (v === 'table'  ? 'btn-primary' : 'btn-secondary');
    render();
  }

  function render() {
    if (_view === 'kanban') renderKanban();
    else renderTable();
  }

  function renderKanban() {
    const rows  = Data.enriched();
    const board = document.getElementById('tracking-kanban');
    const today = new Date().toISOString().slice(0, 10);
    const in7d  = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

    const tracked = rows.filter(r => get(r.id));
    if (!tracked.length) {
      board.innerHTML = `<div class="empty-state">
        <div class="icon">[ ]</div>
        <p>Sin seguimiento registrado. Ingrese a <strong>Detalle normativa</strong> para registrar el seguimiento de cada norma.</p>
      </div>`;
      return;
    }

    board.innerHTML = '<div class="kanban-board">' +
      STATUSES.map(s => {
        const cards = tracked.filter(r => {
          const t = get(r.id);
          return t && t.progress_status === s.id;
        });
        const cardsHtml = cards.map(r => {
          const t = get(r.id) || {};
          const riskClass = r.risk_level || 'bajo';
          let dueLine = '';
          if (t.due_date) {
            const cls = t.due_date < today ? 'due-overdue' : (t.due_date <= in7d ? 'due-soon' : 'due-ok');
            dueLine = `<span class="${cls}">${t.due_date}</span>`;
          }
          return `<div class="kanban-card" onclick="App.navigateDetail(${r.id})">
            <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
              <div class="risk-dot ${riskClass}" style="margin-top:4px;flex-shrink:0;"></div>
              <div class="card-title">${(r.title || '').substring(0, 72)}…</div>
            </div>
            <div class="card-meta">
              <span>${t.responsible_area || '—'}</span>
              <span>${t.owner || '—'}</span>
              ${dueLine}
            </div>
          </div>`;
        }).join('');

        return `<div class="kanban-col">
          <div class="kanban-col-header">
            <span style="color:${s.color};">${s.label}</span>
            <span class="count">${cards.length}</span>
          </div>
          ${cardsHtml || '<div style="font-size:.72rem;color:#94a3b8;padding:6px 4px;">Sin normas</div>'}
        </div>`;
      }).join('') + '</div>';
  }

  function renderTable() {
    const tbody  = document.getElementById('tracking-tbody');
    const rows   = Data.enriched();
    const tracked = rows.filter(r => get(r.id));

    if (!tracked.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:32px;">Sin seguimiento registrado</td></tr>';
      return;
    }
    tbody.innerHTML = tracked.map(r => {
      const t = get(r.id) || {};
      const today = new Date().toISOString().slice(0, 10);
      const in7d  = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      let dueTd = t.due_date || '—';
      if (t.due_date) {
        const cls = t.due_date < today ? 'due-overdue' : (t.due_date <= in7d ? 'due-soon' : '');
        dueTd = `<span class="${cls}">${t.due_date}</span>`;
      }
      return `<tr onclick="App.navigateDetail(${r.id})">
        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.title}">${r.title}</td>
        <td style="font-size:.78rem;">${r.regulator}</td>
        <td>${t.responsible_area || '—'}</td>
        <td>${t.owner || '—'}</td>
        <td>${dueTd}</td>
        <td><span class="badge badge-${t.impact_level || 'bajo'}">${t.impact_level || '—'}</span></td>
        <td>${PROGRESS_LABEL[t.progress_status] || t.progress_status || '—'}</td>
        <td style="font-weight:600;">${r.risk_score ?? '—'}</td>
      </tr>`;
    }).join('');
  }

  return { get, set, all, render, setView, STATUSES };
})();
