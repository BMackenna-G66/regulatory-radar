const Data = (() => {
  let _items    = [];
  let _analysis = [];
  let _sources  = [];
  let _categories = [];

  async function load() {
    const [items, analysis, sources, categories] = await Promise.all([
      fetch('./data/regulatory_items.json').then(r => r.json()).catch(() => []),
      fetch('./data/ai_analysis.json').then(r => r.json()).catch(() => []),
      fetch('./data/sources.json').then(r => r.json()).catch(() => []),
      fetch('./data/categories.json').then(r => r.json()).catch(() => []),
    ]);
    _items      = items;
    _analysis   = analysis;
    _sources    = sources;
    _categories = categories;
    return { items, analysis, sources, categories };
  }

  function _getManualItems() {
    try { return JSON.parse(localStorage.getItem('rr_manual_items_v1') || '[]'); }
    catch (_) { return []; }
  }

  function _getOverrides() {
    try { return JSON.parse(localStorage.getItem('rr_item_overrides_v1') || '{}'); }
    catch (_) { return {}; }
  }

  function items() {
    const overrides = _getOverrides();
    const manual    = _getManualItems();
    const base = _items.map(item => {
      const ov = overrides[item.id];
      return ov ? { ...item, ...ov } : item;
    });
    return [...base, ...manual];
  }

  function analysis()   { return _analysis; }
  function sources()    { return _sources; }
  function categories() { return _categories; }

  function analysisFor(itemId) {
    return _analysis.find(a => a.item_id === itemId) || null;
  }

  function itemById(id) {
    return items().find(i => i.id === id) || null;
  }

  function enriched(filters = {}) {
    return items()
      .map(item => {
        const a = analysisFor(item.id) || {};
        const t = Tracking.get(item.id) || {};
        return { ...item, ...a, ...t, _item: item, _analysis: a, _tracking: t };
      })
      .filter(row => {
        if (filters.entity    && row.entity_applicable !== filters.entity)    return false;
        if (filters.regulator && row.regulator         !== filters.regulator) return false;
        if (filters.doctype   && row.document_type     !== filters.doctype)   return false;
        if (filters.risk      && row.risk_level        !== filters.risk)      return false;
        if (filters.impl      && row.implementation_status !== filters.impl)  return false;
        if (filters.risk_consolidated && row.risk_consolidated !== filters.risk_consolidated) return false;
        if (filters.status    && row.status            !== filters.status)    return false;
        if (filters.category  && row.thematic_classification !== filters.category) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const haystack = [row.title, row.identifier, row.regulated_subject, row.regulator]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.publication_date || b.detected_at || '').localeCompare(a.publication_date || a.detected_at || ''));
  }

  function stats() {
    const rows  = enriched();
    const today = new Date().toISOString().slice(0, 10);
    const in7d  = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

    const byRegulator  = {};
    const byCategory   = {};
    const byEntity     = {};
    const byImplStatus = {};

    rows.forEach(r => {
      byRegulator[r.regulator] = (byRegulator[r.regulator] || 0) + 1;
      if (r.thematic_classification)
        byCategory[r.thematic_classification] = (byCategory[r.thematic_classification] || 0) + 1;
      const ent = r.entity_applicable || 'No especificada';
      byEntity[ent] = (byEntity[ent] || 0) + 1;
      const impl = r.implementation_status || 'No especificado';
      byImplStatus[impl] = (byImplStatus[impl] || 0) + 1;
    });

    const tracking = rows.map(r => Tracking.get(r.id)).filter(Boolean);

    return {
      total:         rows.length,
      nuevo:         rows.filter(r => r.status === 'nuevo').length,
      applicable:    rows.filter(r => ['aplica_informativo','aplica_requiere_accion'].includes(r.status)).length,
      critical:      rows.filter(r => r.risk_consolidated === 'ALTO').length,
      en_revision:   rows.filter(r => r.status === 'en_revision').length,
      implementado:  rows.filter(r => r.implementation_status === 'Implementado').length,
      en_proceso:    rows.filter(r => r.implementation_status === 'En Proceso').length,
      expiring_soon: tracking.filter(t =>
        t.due_date && t.due_date >= today && t.due_date <= in7d &&
        !['implementado','cerrado'].includes(t.progress_status)
      ).length,
      byRegulator: Object.fromEntries(Object.entries(byRegulator).sort((a, b) => b[1] - a[1])),
      byCategory,
      byEntity,
      byImplStatus,
    };
  }

  return { load, items, analysis, sources, categories, analysisFor, itemById, enriched, stats };
})();
