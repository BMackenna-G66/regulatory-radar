const Detail = (() => {
  let _currentId = null;

  const IMPL_LABEL = {
    'Implementado':  'Implementado',
    'En Proceso':    'En Proceso',
    'Pendiente':     'Pendiente',
    'N/A':           'No aplica',
  };

  const IMPL_BADGE = {
    'Implementado': 'implementado',
    'En Proceso':   'aplica_requiere_accion',
    'Pendiente':    'nuevo',
    'N/A':          'no_aplica',
  };

  const IMPACT_COLORS = { 'ALTO': 'var(--critico)', 'MEDIO': 'var(--alto)', 'BAJO': 'var(--bajo)' };

  function render(itemId) {
    _currentId = itemId;
    const item     = Data.itemById(itemId);
    const analysis = Data.analysisFor(itemId);
    if (!item) { App.toast('Normativa no encontrada', 'error'); return; }

    document.getElementById('detail-title').textContent = `${item.identifier || ''} — ${item.title}`;
    const implBadge = IMPL_BADGE[item.implementation_status] || 'nuevo';
    const riskBadge = item.risk_consolidated === 'ALTO' ? 'critico' : item.risk_consolidated === 'MEDIO' ? 'alto' : 'bajo';
    document.getElementById('detail-status-badge').innerHTML =
      `<span class="badge badge-${implBadge}">${item.implementation_status || '—'}</span>` +
      `<span class="badge badge-${riskBadge}" style="margin-left:6px;">Riesgo ${item.risk_consolidated || '—'}</span>` +
      `<span class="badge" style="background:#e8f0fd;color:#1e5fbc;margin-left:6px;font-size:.72rem;">${item.entity_applicable || '—'}</span>`;

    document.getElementById('detail-meta').innerHTML = [
      { label: 'Regulador',   value: item.regulator },
      { label: 'Tipo',        value: item.document_type || '—' },
      { label: 'Publicado',   value: item.publication_date || '—' },
      { label: 'Vigencia',    value: item.effective_date || '—' },
      { label: 'Entidad',     value: item.entity_applicable || '—' },
      { label: 'Area resp.',  value: item.responsible_area || '—' },
    ].map(m => `<div class="meta-item">
        <span class="label">${m.label}</span>
        <span class="value">${m.value}</span>
      </div>`).join('');

    _renderImpactMatrix(item);
    _renderAnalysis(analysis, item);
    _renderObligations(item);
    _renderOriginal(item);
    _renderTrackingForm(itemId, analysis, item);

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector('.tab[data-tab="analysis"]')?.classList.add('active');
    document.getElementById('tab-analysis')?.classList.add('active');
  }

  function _renderImpactMatrix(item) {
    const dims = [
      { key: 'impact_legal',         label: 'Legal' },
      { key: 'impact_operational',   label: 'Operacional' },
      { key: 'impact_technological', label: 'Tecnologico' },
      { key: 'impact_aml_cft',       label: 'AML/CFT' },
      { key: 'impact_customer',      label: 'Clientes' },
    ];
    document.getElementById('detail-impact-matrix').innerHTML = dims.map(d => {
      const val = item[d.key] || '—';
      const color = IMPACT_COLORS[val] || '#94a3b8';
      return `<div class="impact-dim">
        <div class="impact-dim-label">${d.label}</div>
        <div class="impact-dim-value" style="color:${color};">${val}</div>
        <div class="impact-dim-bar">
          <div class="impact-dim-fill" style="background:${color};width:${val==='ALTO'?100:val==='MEDIO'?55:25}%;"></div>
        </div>
      </div>`;
    }).join('');
  }

  function _renderAnalysis(a, item) {
    const riskCls = item.risk_consolidated === 'ALTO' ? 'critico' : item.risk_consolidated === 'MEDIO' ? 'alto' : 'bajo';

    document.getElementById('detail-kpis').innerHTML = [
      { label: 'Riesgo Consolidado', value: item.risk_consolidated || '—', cls: riskCls },
      { label: 'Prioridad Impl.',    value: item.implementation_deadline || '—', cls: '' },
      { label: 'Estado Impl.',       value: item.implementation_status || '—', cls: '' },
      { label: 'Entidad',            value: item.entity_applicable || '—', cls: '' },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="font-size:1.1rem;">${k.value}</div>
      </div>`).join('');

    if (!a) {
      document.getElementById('detail-analysis-grid').innerHTML =
        '<div class="detail-card"><p style="color:#94a3b8;">Analisis no disponible.</p></div>';
      return;
    }

    const left = [
      { title: 'Resumen ejecutivo',     text: a.executive_summary || item.executive_summary },
      { title: 'Impacto posible',       text: a.possible_impact || item.required_actions },
      { title: 'Accion recomendada',    text: a.recommended_action || item.required_actions },
    ];
    const right = [
      { title: 'Areas afectadas',       text: a.affected_areas || item.responsible_area },
      { title: 'Fecha max. aplicacion', text: a.max_application_date || item.implementation_deadline || 'No especificada' },
      { title: 'Categoria tematica',    text: a.thematic_classification },
      { title: 'Materia regulada',      text: item.regulated_subject },
      { title: 'Evidencia esperada',    text: item.expected_evidence },
    ];

    document.getElementById('detail-analysis-grid').innerHTML =
      `<div style="display:flex;flex-direction:column;gap:14px;">
        ${left.map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${right.map(f => `<div class="detail-card"><h3>${f.title}</h3><p>${f.text || '—'}</p></div>`).join('')}
      </div>`;
  }

  function _renderObligations(item) {
    const el = document.getElementById('detail-obligations-content');
    if (!el) return;
    el.innerHTML = `
      <div class="detail-card" style="margin-top:16px;">
        <h3>Obligaciones principales para Global66</h3>
        <p>${item.main_obligations || '—'}</p>
      </div>
      <div class="detail-card">
        <h3>Acciones requeridas</h3>
        <p>${item.required_actions || '—'}</p>
      </div>
      <div class="detail-card">
        <h3>Evidencia de cumplimiento esperada</h3>
        <p>${item.expected_evidence || '—'}</p>
      </div>
      <div class="detail-card">
        <h3>Observaciones</h3>
        <p>${item.observations || '—'}</p>
      </div>`;
  }

  function _renderOriginal(item) {
    const link = document.getElementById('detail-source-link');
    if (item.source_url) {
      link.href        = item.source_url.startsWith('http') ? item.source_url : `https://${item.source_url}`;
      link.textContent = item.source_url;
    } else {
      link.href        = '#';
      link.textContent = 'URL no disponible';
    }

    document.getElementById('detail-original-info').innerHTML = [
      ['Identificador',        item.identifier],
      ['Regulador',            item.regulator],
      ['Tipo',                 item.document_type],
      ['Entidad aplicable',    item.entity_applicable],
      ['Publicado',            item.publication_date],
      ['Vigencia',             item.effective_date],
      ['Estado norma',         item.norm_state],
      ['Materia regulada',     item.regulated_subject],
      ['Riesgo consolidado',   item.risk_consolidated],
      ['Impacto legal',        item.impact_legal],
      ['Impacto operacional',  item.impact_operational],
      ['Impacto tecnologico',  item.impact_technological],
      ['Impacto AML/CFT',      item.impact_aml_cft],
      ['Impacto clientes',     item.impact_customer],
      ['Estado implementacion',item.implementation_status],
      ['Fecha limite',         item.implementation_deadline],
      ['Ultima revision',      item.last_review_date],
      ['Responsable',          item.responsible_update],
    ].map(([l, v]) => `<div style="display:flex;gap:0;padding:5px 0;border-bottom:1px solid var(--border);">
        <div style="width:180px;font-weight:600;color:#5a6880;font-size:.8rem;flex-shrink:0;">${l}</div>
        <div style="font-size:.84rem;">${v || '—'}</div>
      </div>`).join('');
  }

  function _renderTrackingForm(itemId, analysis, item) {
    const t = Tracking.get(itemId) || {};
    const d = {
      applies:          t.applies          || (item.implementation_status === 'N/A' ? 'No' : 'Si'),
      responsible_area: t.responsible_area || (item.responsible_area || 'Compliance').split('/')[0].trim(),
      owner:            t.owner            || '',
      due_date:         t.due_date         || '',
      impact_level:     t.impact_level     || (item.risk_consolidated === 'ALTO' ? 'critico' : item.risk_consolidated === 'MEDIO' ? 'alto' : 'bajo'),
      progress_status:  t.progress_status  || _implToProgress(item.implementation_status),
      required_action:  t.required_action  || item.required_actions || '',
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

  function _implToProgress(impl) {
    if (impl === 'Implementado') return 'implementado';
    if (impl === 'En Proceso')   return 'en_implementacion';
    return 'pendiente_revision';
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
