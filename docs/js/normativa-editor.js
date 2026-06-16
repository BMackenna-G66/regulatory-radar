/**
 * NormativaEditor — CRUD manual de normativas
 * Nuevas normas    → localStorage: rr_manual_items_v1  (array)
 * Edits existentes → localStorage: rr_item_overrides_v1 (obj keyed by id)
 */
const NormativaEditor = (() => {
  const MANUAL_KEY   = 'rr_manual_items_v1';
  const OVERRIDE_KEY = 'rr_item_overrides_v1';

  let _editingId = null;

  // ── Storage helpers ──────────────────────────────────────────────────────
  function getManualItems() {
    try { return JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function getOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function _saveManual(items) {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(items));
  }

  function _saveOverrides(ov) {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(ov));
  }

  function _nextId() {
    const manual   = getManualItems().map(i => i.id).filter(Number.isFinite);
    const existing = Data.items().map(i => i.id).filter(Number.isFinite);
    return Math.max(10000, ...manual, ...existing) + 1;
  }

  // ── Open / close ─────────────────────────────────────────────────────────
  function open(itemId = null) {
    _editingId = itemId;
    const item = itemId !== null ? Data.itemById(itemId) : null;
    _fillForm(item);
    document.getElementById('modal-normativa-editor').style.display = '';
    document.getElementById('ne-modal-title').textContent =
      itemId !== null ? 'Editar Normativa' : 'Nueva Normativa';

    // Show delete button only for manual items
    const delBtn = document.getElementById('ne-delete-btn');
    if (delBtn) delBtn.style.display = (itemId !== null && itemId >= 10000) ? '' : 'none';

    // Reset to first tab
    document.querySelectorAll('.ne-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ne-tab-pane').forEach(p => p.style.display = 'none');
    document.querySelector('.ne-tab[data-ne-tab="identificacion"]')?.classList.add('active');
    document.getElementById('ne-tab-identificacion').style.display = '';
  }

  function close() {
    document.getElementById('modal-normativa-editor').style.display = 'none';
    _editingId = null;
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function _fillForm(item) {
    _set('ne-title',              item?.title);
    _set('ne-identifier',         item?.identifier);
    _set('ne-document-type',      item?.document_type);
    _set('ne-regulator',          item?.regulator);
    _set('ne-country',            item?.country || 'Chile');
    _set('ne-entity',             item?.entity_applicable || 'Ambas');
    _set('ne-pub-date',           item?.publication_date);
    _set('ne-eff-date',           item?.effective_date);
    _set('ne-norm-state',         item?.norm_state || 'Vigente');
    _set('ne-impl-deadline',      item?.implementation_deadline);
    _set('ne-impl-status',        item?.implementation_status || 'Pendiente');
    _set('ne-subject',            item?.regulated_subject);
    _set('ne-summary',            item?.executive_summary);
    _set('ne-obligations',        item?.main_obligations);
    _set('ne-actions',            item?.required_actions);
    _set('ne-evidence',           item?.expected_evidence);
    _set('ne-risk',               item?.risk_consolidated || 'MEDIO');
    _set('ne-impact-legal',       item?.impact_legal || '');
    _set('ne-impact-operational', item?.impact_operational || '');
    _set('ne-impact-tech',        item?.impact_technological || '');
    _set('ne-impact-aml',         item?.impact_aml_cft || '');
    _set('ne-impact-customer',    item?.impact_customer || '');
    _set('ne-area',               item?.responsible_area);
    _set('ne-source-url',         item?.source_url);
    _set('ne-observations',       item?.observations);
    _set('ne-last-review',        item?.last_review_date);
    _set('ne-responsible-update', item?.responsible_update);
  }

  function _readForm() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    return {
      title:                   v('ne-title'),
      identifier:              v('ne-identifier'),
      document_type:           v('ne-document-type'),
      regulator:               v('ne-regulator'),
      country:                 v('ne-country') || 'Chile',
      entity_applicable:       v('ne-entity'),
      publication_date:        v('ne-pub-date'),
      effective_date:          v('ne-eff-date'),
      norm_state:              v('ne-norm-state'),
      implementation_deadline: v('ne-impl-deadline'),
      implementation_status:   v('ne-impl-status'),
      regulated_subject:       v('ne-subject'),
      executive_summary:       v('ne-summary'),
      main_obligations:        v('ne-obligations'),
      required_actions:        v('ne-actions'),
      expected_evidence:       v('ne-evidence'),
      risk_consolidated:       v('ne-risk'),
      impact_legal:            v('ne-impact-legal')       || null,
      impact_operational:      v('ne-impact-operational') || null,
      impact_technological:    v('ne-impact-tech')        || null,
      impact_aml_cft:          v('ne-impact-aml')         || null,
      impact_customer:         v('ne-impact-customer')    || null,
      responsible_area:        v('ne-area'),
      source_url:              v('ne-source-url'),
      observations:            v('ne-observations'),
      last_review_date:        v('ne-last-review'),
      responsible_update:      v('ne-responsible-update'),
    };
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function save() {
    const data = _readForm();
    if (!data.title || !data.regulator) {
      App.toast('Título y Regulador son obligatorios', 'error'); return;
    }

    const STATUS_MAP = {
      'Implementado': 'implementado',
      'En Proceso':   'aplica_requiere_accion',
      'Pendiente':    'aplica_requiere_accion',
      'N/A':          'no_aplica',
    };
    data.status = STATUS_MAP[data.implementation_status] || 'nuevo';

    if (_editingId !== null) {
      const overrides = getOverrides();
      overrides[_editingId] = { ...(overrides[_editingId] || {}), ...data };
      _saveOverrides(overrides);
      App.toast('Normativa actualizada correctamente', 'success');
    } else {
      const items = getManualItems();
      data.id          = _nextId();
      data.detected_at = new Date().toISOString();
      data._manual     = true;
      items.push(data);
      _saveManual(items);
      App.toast('Normativa agregada correctamente', 'success');
    }

    close();
    App.reload();
  }

  // ── Delete (manual items only) ────────────────────────────────────────────
  function deleteManual(itemId) {
    if (!confirm('¿Eliminar esta normativa manual? Esta acción no se puede deshacer.')) return;
    _saveManual(getManualItems().filter(i => i.id !== itemId));
    const ov = getOverrides();
    delete ov[itemId];
    _saveOverrides(ov);
    close();
    App.toast('Normativa eliminada', 'success');
    App.navigate('inbox');
    App.reload();
  }

  // ── Tab switching inside modal ────────────────────────────────────────────
  document.addEventListener('click', e => {
    const tab = e.target.closest('.ne-tab');
    if (!tab) return;
    document.querySelectorAll('.ne-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ne-tab-pane').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    const pane = document.getElementById(`ne-tab-${tab.dataset.neTab}`);
    if (pane) pane.style.display = '';
  });

  function editingId() { return _editingId; }

  return { open, close, save, deleteManual, editingId, getManualItems, getOverrides };
})();
