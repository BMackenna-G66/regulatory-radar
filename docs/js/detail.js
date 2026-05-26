const Detail = (() => {
  let _currentId = null;

  const STATUS_LABEL = {
    nuevo:                  'Nuevo',
    en_revision:            'En revision',
    no_aplica:              'No aplica',
    aplica_informativo:     'Aplica — Informativo',
    aplica_requiere_accion: 'Aplica — Requiere accion',
    implementado:           'Implementado',
    vencido:                'Vencido',
  };

  function render(itemId) {
    _currentId = itemId;
    const item     = Data.itemById(itemId);
    const analysis = Data.analysisFor(itemId);
    if (!item) { App.toast('Normativa no encontrada', 'error'); return; }

    document.getElementById('detail-title').textContent = item.title;
    document.getElementById('detail-status-badge').innerHTML =
      `<span class="badge badge-${item.status}">${STATUS_LABEL[item.status] || item.status}</span>`;

    document.getElementById('detail-meta').innerHTML = [
      { label: 'Regulador',    value: item.regulator },
      { label: 'Tipo',         value: item.document_type || '—' },
      { label: 'Publicado',    value: item.publication_date || '—' },
      { label: 'Detectado',    value: item.detected_at?.slice(0, 10) || '—' },
    ].map(m => `<div class="meta-item">
        <span class="label">${m.label}</span>
        <span class="value">${m.value}</span>
      </div>`).join('');

    _renderAnalysis(analysis);
    _renderOriginal(item);
    _renderTrackingForm(itemId, analysis);

    // Reset to first tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab[data-tab="analysis"]')?.classList.add('active');
    document.getElementById('tab-analysis')?.classList.add('active');
  }

  function _renderAnalysis(a) {
    if (!a) {
      document.getElementById('detail-kpis').innerHTML =
        '<p style="color:#94a3b8;font-size:.84rem;">Analisis no disponible para esta norma.</p>';
      document.getElementById('detail-analysis-grid').innerHTML = '';
      return;
    }

    document.getElementById('detail-kpis').innerHTML = [
      { label: 'Risk Score', value: a.risk_score ?? '—', cls: '' },
      { label: 'Nivel',      value: (a.risk_level || '—').toUpperCase(), cls: a.risk_level },
      { label: 'Aplica',     value: a.applies || '—', cls: '' },
      { label: 'Criticidad', value: (a.criticality || '—').toUpperCase(), cls: a.criticality },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="font-size:1.5rem;">${k.value}</div>
      </div>`).join('');

    const left = [
      { title: 'Resumen ejecutivo',       text: a.executive_summary },
      { title: 'Principales cambios',     text: a.main_changes },
      { title: 'Posible impacto',         text: a.possible_impact },
      { title: 'Obligaciones detectadas', text: a.detected_obligations },
    ];
    const right = [
      { title: 'Areas afectadas',          text: a.affected_areas },
      { title: 'Productos / procesos',     text: a.affected_products },
      { title: 'Fecha max. de aplicacion', text: a.max_application_date || 'No especificada' },
      { title: 'Categoria tematica',       text: a.thematic_classification },
      { title: 'Area sugerida',            text: a.suggested_area },
      { title: 'Accion recomendada',       text: a.recommended_action },
    ];

    document.getElementById('detail-analysis-grid').innerHTML =
      `<div style="display:flex;flex-direction:column;gap:14px;">
        ${left.map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${right.map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>`;
  }

  function _renderOriginal(item) {
    const link = document.getElementById('detail-source-link');
    if (item.source_url) {
      link.href        = item.source_url;
      link.textContent = item.source_url;
    } else {
      link.href        = '#';
      link.textContent = 'URL no disponible';
    }

    document.getElementById('detail-original-info').innerHTML =
      [
        ['Regulador',       item.regulator],
        ['Tipo',            item.document_type || '—'],
        ['Pais',            item.country],
        ['Publicado',       item.publication_date || '—'],
        ['Detectado',       item.detected_at?.slice(0, 10) || '—'],
        ['Estado actual',   item.status],
        ['Hash contenido',  item.content_hash],
      ].map(([l, v]) => `<div style="display:flex;gap:0;padding:5px 0;border-bottom:1px solid var(--border);">
          <div style="width:160px;font-weight:600;color:#5a6880;font-size:.8rem;">${l}</div>
          <div style="font-size:.84rem;">${v}</div>
        </div>`).join('');
  }

  function _renderTrackingForm(itemId, analysis) {
    const t = Tracking.get(itemId) || {};
    const d = {
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

    const areas = ['Compliance','Legal','Fraude','Operaciones','Producto','Finanzas','Tecnologia','Data','CX'];
    document.getElementById('tf-applies').value  = d.applies;
    document.getElementById('tf-area').innerHTML =
      areas.map(a => `<option ${a === d.responsible_area ? 'selected' : ''}>${a}</option>`).join('');
    document.getElementById('tf-owner').value     = d.owner;
    document.getElementById('tf-due-date').value  = d.due_date;
    document.getElementById('tf-impact').value    = d.impact_level;
    document.getElementById('tf-progress').value  = d.progress_status;
    document.getElementById('tf-action').value    = d.required_action;
    document.getElementById('tf-plan').value      = d.action_plan;
    document.getElementById('tf-comments').value  = d.comments;
    document.getElementById('tf-evidence').value  = d.evidence_url;
  }

  function currentId() { return _currentId; }
  return { render, currentId };
})();


const TrackingForm = (() => {
  function save(e) {
    e.preventDefault();
    const itemId = Detail.currentId();
    if (!itemId) return;
    Tracking.set(itemId, {
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
    });
    App.toast('Seguimiento guardado correctamente', 'success');
  }
  return { save };
})();


// Tab switching
document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab || !tab.dataset.tab) return;
  tab.closest('.tabs')?.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
});
