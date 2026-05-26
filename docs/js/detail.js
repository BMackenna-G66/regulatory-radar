/**
 * Detail view + Tracking form
 */
const Detail = (() => {
  let _currentId = null;

  const STATUS_LABEL = {
    nuevo:'Nuevo', en_revision:'En revisión', no_aplica:'No aplica',
    aplica_informativo:'Aplica (info)', aplica_requiere_accion:'Aplica (acción)',
    implementado:'Implementado', vencido:'Vencido',
  };

  function render(itemId) {
    _currentId = itemId;
    const item     = Data.itemById(itemId);
    const analysis = Data.analysisFor(itemId);
    if (!item) { App.toast('Normativa no encontrada', 'error'); return; }

    // Header
    document.getElementById('detail-title').textContent = item.title;
    document.getElementById('detail-status-badge').innerHTML =
      `<span class="badge badge-${item.status}">${STATUS_LABEL[item.status] || item.status}</span>`;

    // Meta row
    document.getElementById('detail-meta').innerHTML = [
      { label: 'País',      value: item.country },
      { label: 'Regulador', value: item.regulator },
      { label: 'Tipo',      value: item.document_type || '—' },
      { label: 'Publicado', value: item.publication_date || '—' },
      { label: 'Detectado', value: item.detected_at?.slice(0,10) || '—' },
    ].map(m => `<div class="meta-item">
        <span class="label">${m.label}</span>
        <span class="value">${m.value}</span>
      </div>`).join('');

    _renderAnalysis(analysis, item);
    _renderOriginal(item);
    _renderTrackingForm(itemId, analysis);

    // Reset tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab[data-tab="analysis"]').classList.add('active');
    document.getElementById('tab-analysis').classList.add('active');
  }

  function _renderAnalysis(a, item) {
    if (!a) {
      document.getElementById('detail-kpis').innerHTML =
        '<p style="color:#94a3b8;font-size:.875rem;">Análisis IA no disponible para esta norma.</p>';
      document.getElementById('detail-analysis-grid').innerHTML = '';
      return;
    }

    document.getElementById('detail-kpis').innerHTML = [
      { label: 'Risk Score', value: a.risk_score ?? '—', cls: '' },
      { label: 'Nivel',      value: (a.risk_level||'—').toUpperCase(), cls: a.risk_level },
      { label: '¿Aplica?',   value: a.applies || '—', cls: '' },
      { label: 'Criticidad', value: (a.criticality||'—').toUpperCase(), cls: a.criticality },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="font-size:1.4rem;">${k.value}</div>
      </div>`).join('');

    const fields = [
      { title: '📋 Resumen ejecutivo',        text: a.executive_summary },
      { title: '🔄 Principales cambios',       text: a.main_changes },
      { title: '💥 Posible impacto',           text: a.possible_impact },
      { title: '📌 Obligaciones detectadas',   text: a.detected_obligations },
      { title: '🏢 Áreas afectadas',           text: a.affected_areas },
      { title: '📦 Productos / Procesos',       text: a.affected_products },
      { title: '🗓️ Fecha máx. de aplicación',  text: a.max_application_date || 'No especificada' },
      { title: '🏷️ Categoría temática',        text: a.thematic_classification },
      { title: '💡 Acción recomendada',        text: a.recommended_action },
      { title: '📍 Área sugerida',             text: a.suggested_area },
    ];

    document.getElementById('detail-analysis-grid').innerHTML =
      `<div style="display:flex;flex-direction:column;gap:16px;">
        ${fields.slice(0,5).map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${fields.slice(5).map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>`;
  }

  function _renderOriginal(item) {
    const link = document.getElementById('detail-source-link');
    link.href = item.source_url || '#';
    link.textContent = item.source_url ? `${item.source_url.slice(0,60)}… →` : 'No disponible';

    document.getElementById('detail-original-info').innerHTML = `
      <table style="border-collapse:collapse;width:100%;">
        ${[
          ['País',          item.country],
          ['Regulador',     item.regulator],
          ['Tipo',          item.document_type || '—'],
          ['Publicado',     item.publication_date || '—'],
          ['Detectado',     item.detected_at?.slice(0,10) || '—'],
          ['Estado actual', item.status],
          ['Hash contenido',item.content_hash],
        ].map(([l,v]) => `<tr>
          <td style="padding:6px 12px 6px 0;font-weight:600;color:#64748b;width:160px;">${l}</td>
          <td style="padding:6px 0;">${v}</td>
        </tr>`).join('')}
      </table>`;
  }

  function _renderTrackingForm(itemId, analysis) {
    const t = Tracking.get(itemId) || {};

    const defaults = {
      applies:          t.applies          || analysis?.applies       || 'revisar',
      responsible_area: t.responsible_area || analysis?.suggested_area|| 'Compliance',
      owner:            t.owner            || '',
      due_date:         t.due_date         || analysis?.max_application_date || '',
      impact_level:     t.impact_level     || analysis?.criticality   || 'medio',
      progress_status:  t.progress_status  || 'pendiente_revision',
      required_action:  t.required_action  || analysis?.recommended_action || '',
      action_plan:      t.action_plan      || '',
      comments:         t.comments         || '',
      evidence_url:     t.evidence_url     || '',
    };

    const areas = ['Compliance','Legal','Fraude','Operaciones','Producto','Finanzas','Tecnología','Data','CX'];
    const areaOpts = areas.map(a => `<option ${a === defaults.responsible_area ? 'selected' : ''}>${a}</option>`).join('');
    const appliesOpts = ['sí','no','revisar'].map(v =>
      `<option ${v === defaults.applies ? 'selected' : ''}>${v}</option>`).join('');
    const impactOpts = ['bajo','medio','alto','crítico'].map(v =>
      `<option ${v === defaults.impact_level ? 'selected' : ''}>${v}</option>`).join('');
    const PROGRESS = [
      ['pendiente_revision','⏳ Pendiente revisión'],['asignado','👤 Asignado'],
      ['en_implementacion','🔧 En implementación'],['bloqueado','🚫 Bloqueado'],
      ['implementado','✅ Implementado'],['cerrado','🔒 Cerrado'],
    ];
    const progressOpts = PROGRESS.map(([v,l]) =>
      `<option value="${v}" ${v === defaults.progress_status ? 'selected' : ''}>${l}</option>`).join('');

    document.getElementById('tf-applies').innerHTML  = appliesOpts;
    document.getElementById('tf-area').innerHTML     = areaOpts;
    document.getElementById('tf-owner').value        = defaults.owner;
    document.getElementById('tf-due-date').value     = defaults.due_date;
    document.getElementById('tf-impact').innerHTML   = impactOpts;
    document.getElementById('tf-progress').innerHTML = progressOpts;
    document.getElementById('tf-action').value       = defaults.required_action;
    document.getElementById('tf-plan').value         = defaults.action_plan;
    document.getElementById('tf-comments').value     = defaults.comments;
    document.getElementById('tf-evidence').value     = defaults.evidence_url;
  }

  function currentId() { return _currentId; }

  return { render, currentId };
})();


/* ── Tracking form save ──────────────────────────────────────────────────── */
const TrackingForm = (() => {
  function save(e) {
    e.preventDefault();
    const itemId = Detail.currentId();
    if (!itemId) return;

    const record = {
      applies:          document.getElementById('tf-applies').value,
      responsible_area: document.getElementById('tf-area').value,
      owner:            document.getElementById('tf-owner').value,
      due_date:         document.getElementById('tf-due-date').value,
      impact_level:     document.getElementById('tf-impact').value,
      progress_status:  document.getElementById('tf-progress').value,
      required_action:  document.getElementById('tf-action').value,
      action_plan:      document.getElementById('tf-plan').value,
      comments:         document.getElementById('tf-comments').value,
      evidence_url:     document.getElementById('tf-evidence').value,
    };

    Tracking.set(itemId, record);
    App.toast('Seguimiento guardado ✅', 'success');
  }

  return { save };
})();


/* ── Tab switching (detail page) ─────────────────────────────────────────── */
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  const paneId = tab.dataset.tab;
  if (!paneId) return;
  tab.closest('.tabs')?.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${paneId}`)?.classList.add('active');
});
