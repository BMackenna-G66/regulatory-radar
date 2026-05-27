const Changes = (() => {
  const STORAGE_KEY = 'rr_changes_v1';

  function _load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return stored;
    } catch { return []; }
  }

  function _save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  // Seed from changes.json on first load
  async function seedIfEmpty() {
    const stored = _load();
    if (stored.length === 0) {
      try {
        const fetched = await fetch('./data/changes.json').then(r => r.json()).catch(() => []);
        if (fetched.length) _save(fetched);
      } catch { /* ignore */ }
    }
  }

  function all() { return _load(); }

  function render() {
    seedIfEmpty().then(() => _renderTable());
  }

  function _renderTable() {
    const changes = _load();
    const tbody  = document.getElementById('changes-tbody');
    const kpisEl = document.getElementById('changes-kpis');
    if (!tbody) return;

    const today  = new Date().toISOString().slice(0,10);
    const in7d   = new Date(Date.now() + 7 * 864e5).toISOString().slice(0,10);

    // KPIs
    if (kpisEl) {
      const pending = changes.filter(c => c.status === 'Pendiente').length;
      const alto    = changes.filter(c => c.impact_level === 'ALTO').length;
      const overdue = changes.filter(c => c.deadline && c.deadline < today && c.status !== 'Implementado').length;
      kpisEl.innerHTML = [
        { label: 'Total cambios',  value: changes.length, cls: 'azul' },
        { label: 'Impacto ALTO',   value: alto,           cls: 'critico' },
        { label: 'Pendientes',     value: pending,        cls: pending > 0 ? 'alto' : '' },
        { label: 'Vencidos',       value: overdue,        cls: overdue > 0 ? 'critico' : '' },
      ].map(k => `<div class="kpi-card ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
        </div>`).join('');
    }

    if (!changes.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#94a3b8;">Sin cambios registrados. Use "+ Nuevo cambio" para agregar.</td></tr>';
      return;
    }

    const TYPE_CLS = {
      'Norma Nueva': 'aplica_requiere_accion', 'Modificacion': 'en_revision',
      'Derogacion': 'no_aplica', 'Proyecto de Ley': 'nuevo',
      'Consulta Publica': 'nuevo', 'Alerta OFAC': 'critico',
    };
    const STATUS_CLS = { 'Pendiente': 'nuevo', 'En Proceso': 'aplica_requiere_accion', 'Implementado': 'implementado' };
    const IMPACT_CLS = { 'ALTO': 'critico', 'MEDIO': 'alto', 'BAJO': 'bajo' };

    tbody.innerHTML = changes.slice().reverse().map(c => {
      let deadlineTd = c.deadline || '—';
      if (c.deadline) {
        const cls = c.deadline < today ? 'due-overdue' : c.deadline <= in7d ? 'due-soon' : '';
        deadlineTd = `<span class="${cls}">${c.deadline}</span>`;
      }
      const entityShort = c.entity === 'Global Card S.A.' ? 'GC' : c.entity === 'Global 81 SpA' ? 'G81' : 'Ambas';
      return `<tr>
        <td style="font-size:.78rem;white-space:nowrap;">${(c.detection_date || '').slice(0,10)}</td>
        <td style="font-size:.78rem;font-weight:600;">${c.source || '—'}</td>
        <td style="max-width:220px;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.norm_name || ''}">${c.norm_name || '—'}</td>
        <td><span class="badge badge-${TYPE_CLS[c.change_type] || 'nuevo'}" style="font-size:.68rem;">${c.change_type || '—'}</span></td>
        <td style="font-size:.72rem;">${entityShort}</td>
        <td><span class="badge badge-${IMPACT_CLS[c.impact_level] || 'bajo'}" style="font-size:.68rem;">${c.impact_level || '—'}</span></td>
        <td>${deadlineTd}</td>
        <td><span class="badge badge-${STATUS_CLS[c.status] || 'nuevo'}" style="font-size:.7rem;">${c.status || '—'}</span></td>
        <td>
          <button class="btn btn-outline-blue btn-sm" onclick="Changes.openEdit(${c.id})">Edit</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openNew() {
    document.getElementById('change-modal-title').textContent = 'Nuevo Cambio Normativo';
    document.getElementById('cf-id').value = '';
    document.getElementById('change-form').reset();
    document.getElementById('cf-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('change-modal').style.display = '';
  }

  function openEdit(id) {
    const changes = _load();
    const c = changes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('change-modal-title').textContent = 'Editar Cambio Normativo';
    document.getElementById('cf-id').value           = c.id;
    document.getElementById('cf-date').value         = (c.detection_date || '').slice(0,10);
    document.getElementById('cf-source').value       = c.source || '';
    document.getElementById('cf-norm').value         = c.norm_name || '';
    document.getElementById('cf-type').value         = c.change_type || '';
    document.getElementById('cf-entity').value       = c.entity || 'Ambas';
    document.getElementById('cf-impact').value       = c.impact_level || 'ALTO';
    document.getElementById('cf-description').value  = c.description || '';
    document.getElementById('cf-action').value       = c.required_action || '';
    document.getElementById('cf-responsible').value  = c.responsible || '';
    document.getElementById('cf-deadline').value     = (c.deadline || '').slice(0,10);
    document.getElementById('cf-status').value       = c.status || 'Pendiente';
    document.getElementById('cf-observations').value = c.observations || '';
    document.getElementById('change-modal').style.display = '';
  }

  function closeModal() {
    document.getElementById('change-modal').style.display = 'none';
  }

  function saveChange(e) {
    e.preventDefault();
    const changes = _load();
    const idVal   = document.getElementById('cf-id').value;
    const record  = {
      id:             idVal ? Number(idVal) : (Date.now()),
      detection_date: document.getElementById('cf-date').value,
      source:         document.getElementById('cf-source').value,
      norm_name:      document.getElementById('cf-norm').value,
      change_type:    document.getElementById('cf-type').value,
      entity:         document.getElementById('cf-entity').value,
      impact_level:   document.getElementById('cf-impact').value,
      description:    document.getElementById('cf-description').value,
      required_action:document.getElementById('cf-action').value,
      responsible:    document.getElementById('cf-responsible').value,
      deadline:       document.getElementById('cf-deadline').value,
      status:         document.getElementById('cf-status').value,
      observations:   document.getElementById('cf-observations').value,
      created_at:     idVal ? (changes.find(x => x.id === Number(idVal))?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };
    if (idVal) {
      const idx = changes.findIndex(x => x.id === Number(idVal));
      if (idx >= 0) changes[idx] = record; else changes.push(record);
    } else {
      changes.push(record);
    }
    _save(changes);
    closeModal();
    App.toast('Cambio guardado correctamente', 'success');
    _renderTable();
  }

  return { render, openNew, openEdit, closeModal, saveChange, all };
})();
