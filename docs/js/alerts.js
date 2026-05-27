const Alerts = (() => {
  const STORAGE_KEY = 'rr_alerts_v1';

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function _save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  const LEVEL_CONFIG = {
    urgente:     { label: 'URGENTE',     cls: 'critico',  border: 'var(--critico)' },
    seguimiento: { label: 'SEGUIMIENTO', cls: 'alto',     border: 'var(--alto)' },
    informativa: { label: 'INFORMATIVA', cls: 'bajo',     border: 'var(--bajo)' },
  };
  const STATUS_CLS = { 'abierta': 'nuevo', 'en_gestion': 'aplica_requiere_accion', 'cerrada': 'implementado' };
  const STATUS_LABEL = { 'abierta': 'Abierta', 'en_gestion': 'En gestion', 'cerrada': 'Cerrada' };

  function render() {
    const alerts = _load();
    const listEl  = document.getElementById('alerts-list');
    const kpisEl  = document.getElementById('alerts-kpis');
    if (!listEl) return;

    if (kpisEl) {
      const urgentes  = alerts.filter(a => a.level === 'urgente' && a.status !== 'cerrada').length;
      const abiertas  = alerts.filter(a => a.status === 'abierta').length;
      const en_gestion= alerts.filter(a => a.status === 'en_gestion').length;
      kpisEl.innerHTML = [
        { label: 'Total alertas',   value: alerts.length, cls: 'azul' },
        { label: 'URGENTE abiertas',value: urgentes,      cls: urgentes > 0 ? 'critico' : '' },
        { label: 'Abiertas',        value: abiertas,      cls: abiertas > 0 ? 'alto' : '' },
        { label: 'En gestion',      value: en_gestion,    cls: '' },
      ].map(k => `<div class="kpi-card ${k.cls}">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
        </div>`).join('');
    }

    if (!alerts.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="icon">A</div>
        <p>Sin alertas registradas. Use "+ Nueva alerta" para crear la primera.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = alerts.slice().reverse().map(a => {
      const cfg      = LEVEL_CONFIG[a.level] || LEVEL_CONFIG.informativa;
      const statusCls = STATUS_CLS[a.status] || 'nuevo';
      const entityBadge = a.entity === 'Ambas'
        ? '<span style="font-size:.7rem;background:#e8f0fd;color:#1e5fbc;padding:2px 6px;border-radius:4px;">Ambas</span>'
        : `<span style="font-size:.7rem;background:#dff5ec;color:#1a7a3e;padding:2px 6px;border-radius:4px;">${a.entity}</span>`;
      const obligations = (a.obligations || '').split('\n').filter(Boolean)
        .map(l => `<li style="margin:2px 0;">${l}</li>`).join('');

      return `<div class="alert-card" style="border-left:4px solid ${cfg.border};margin-bottom:16px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px;">
          <span class="badge badge-${cfg.cls}" style="flex-shrink:0;">${cfg.label}</span>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:.9rem;">${a.title || '—'}</div>
            <div style="font-size:.75rem;color:#5a6880;margin-top:2px;">${a.source || '—'} · ${entityBadge}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <span class="badge badge-${statusCls}" style="font-size:.7rem;">${STATUS_LABEL[a.status] || a.status}</span>
            <button class="btn btn-outline-blue btn-sm" onclick="Alerts.openEdit(${a.id})">Edit</button>
          </div>
        </div>
        ${a.description ? `<p style="font-size:.82rem;color:#3d4a5c;margin:0 0 8px;">${a.description}</p>` : ''}
        ${obligations ? `<ul style="font-size:.8rem;color:#3d4a5c;margin:0 0 8px;padding-left:20px;">${obligations}</ul>` : ''}
        <div style="display:flex;gap:16px;font-size:.72rem;color:#5a6880;">
          ${a.pub_date    ? `<span>Publicado: ${a.pub_date}</span>` : ''}
          ${a.deadline    ? `<span style="font-weight:600;color:var(--alto);">Fecha limite: ${a.deadline}</span>` : ''}
          <span style="margin-left:auto;">Creada: ${(a.created_at || '').slice(0,10)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function openNew() {
    document.getElementById('alert-modal-title').textContent = 'Nueva Alerta Regulatoria';
    document.getElementById('af-id').value = '';
    document.getElementById('alert-form').reset();
    document.getElementById('af-pub-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('alert-modal').style.display = '';
  }

  function openEdit(id) {
    const a = _load().find(x => x.id === id);
    if (!a) return;
    document.getElementById('alert-modal-title').textContent = 'Editar Alerta';
    document.getElementById('af-id').value          = a.id;
    document.getElementById('af-level').value       = a.level || 'urgente';
    document.getElementById('af-source').value      = a.source || '';
    document.getElementById('af-entity').value      = a.entity || 'Ambas';
    document.getElementById('af-title').value       = a.title || '';
    document.getElementById('af-description').value = a.description || '';
    document.getElementById('af-obligations').value = a.obligations || '';
    document.getElementById('af-pub-date').value    = a.pub_date || '';
    document.getElementById('af-deadline').value    = a.deadline || '';
    document.getElementById('af-status').value      = a.status || 'abierta';
    document.getElementById('alert-modal').style.display = '';
  }

  function closeModal() {
    document.getElementById('alert-modal').style.display = 'none';
  }

  function saveAlert(e) {
    e.preventDefault();
    const alerts = _load();
    const idVal  = document.getElementById('af-id').value;
    const record = {
      id:           idVal ? Number(idVal) : Date.now(),
      level:        document.getElementById('af-level').value,
      source:       document.getElementById('af-source').value,
      entity:       document.getElementById('af-entity').value,
      title:        document.getElementById('af-title').value,
      description:  document.getElementById('af-description').value,
      obligations:  document.getElementById('af-obligations').value,
      pub_date:     document.getElementById('af-pub-date').value,
      deadline:     document.getElementById('af-deadline').value,
      status:       document.getElementById('af-status').value,
      created_at:   idVal ? (alerts.find(x => x.id === Number(idVal))?.created_at || new Date().toISOString()) : new Date().toISOString(),
    };
    if (idVal) {
      const idx = alerts.findIndex(x => x.id === Number(idVal));
      if (idx >= 0) alerts[idx] = record; else alerts.push(record);
    } else {
      alerts.push(record);
    }
    _save(alerts);
    closeModal();
    App.toast('Alerta guardada correctamente', 'success');
    render();
  }

  return { render, openNew, openEdit, closeModal, saveAlert };
})();
