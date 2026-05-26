/**
 * Tracking – persists follow-up data in localStorage
 */
const Tracking = (() => {
  const KEY = 'rr_tracking_v1';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }
  function _save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  function get(itemId) {
    return _load()[String(itemId)] || null;
  }

  function set(itemId, record) {
    const data = _load();
    data[String(itemId)] = { ...record, item_id: itemId, last_update: new Date().toISOString() };
    _save(data);
  }

  function all() {
    const store = _load();
    return Object.values(store);
  }

  /* ── View: Kanban + Table ──────────────────────────────────────────────── */
  const STATUSES = [
    { id: 'pendiente_revision', label: '⏳ Pendiente',         color: '#f59e0b' },
    { id: 'asignado',           label: '👤 Asignado',          color: '#3b82f6' },
    { id: 'en_implementacion',  label: '🔧 En implementación', color: '#8b5cf6' },
    { id: 'bloqueado',          label: '🚫 Bloqueado',         color: '#ef4444' },
    { id: 'implementado',       label: '✅ Implementado',      color: '#22c55e' },
    { id: 'cerrado',            label: '🔒 Cerrado',           color: '#94a3b8' },
  ];

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
    const today = new Date().toISOString().slice(0,10);
    const in7d  = new Date(Date.now()+7*864e5).toISOString().slice(0,10);

    if (!rows.length) {
      board.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin normas registradas</p></div>';
      return;
    }

    const tracked = rows.filter(r => get(r.id));
    if (!tracked.length) {
      board.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No hay seguimiento registrado aún.<br/>Ve a <strong>Detalle normativa</strong> → pestaña <strong>Seguimiento</strong>.</p></div>';
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
          const riskDot = { crítico:'🔴', alto:'🟠', medio:'🟡', bajo:'🟢' }[r.risk_level] || '⚪';
          let dueBadge = '';
          if (t.due_date) {
            const cls = t.due_date < today ? 'color:var(--critico)' : (t.due_date <= in7d ? 'color:var(--alto)' : 'color:var(--bajo)');
            dueBadge = `<span style="${cls}">📅 ${t.due_date}</span>`;
          }
          return `<div class="kanban-card" onclick="App.navigateDetail(${r.id})">
            <div class="card-title">${riskDot} ${(r.title||'').substring(0,70)}…</div>
            <div class="card-meta">
              <span>📍 ${t.responsible_area||'—'}</span>
              <span>👤 ${t.owner||'—'}</span>
              ${dueBadge}
            </div>
          </div>`;
        }).join('');
        return `<div class="kanban-col">
          <div class="kanban-col-header">
            <span style="color:${s.color}">${s.label}</span>
            <span class="count">${cards.length}</span>
          </div>
          ${cardsHtml || '<div style="font-size:.75rem;color:#94a3b8;padding:8px 4px;">Sin normas</div>'}
        </div>`;
      }).join('') + '</div>';
  }

  function renderTable() {
    const tbody = document.getElementById('tracking-tbody');
    const rows  = Data.enriched();
    const tracked = rows.filter(r => get(r.id));
    const PROGRESS_LABEL = {
      pendiente_revision:'⏳ Pendiente', asignado:'👤 Asignado',
      en_implementacion:'🔧 En impl.', bloqueado:'🚫 Bloqueado',
      implementado:'✅ Implementado', cerrado:'🔒 Cerrado',
    };
    if (!tracked.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:32px;">Sin seguimiento registrado</td></tr>';
      return;
    }
    tbody.innerHTML = tracked.map(r => {
      const t = get(r.id) || {};
      return `<tr onclick="App.navigateDetail(${r.id})">
        <td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.title}">${r.title}</td>
        <td>${r.country}</td>
        <td>${t.responsible_area||'—'}</td>
        <td>${t.owner||'—'}</td>
        <td>${t.due_date||'—'}</td>
        <td><span class="badge badge-${t.impact_level||'bajo'}">${t.impact_level||'—'}</span></td>
        <td>${PROGRESS_LABEL[t.progress_status]||t.progress_status||'—'}</td>
        <td>${r.risk_score ?? '—'}</td>
      </tr>`;
    }).join('');
  }

  return { get, set, all, render, setView, STATUSES };
})();
