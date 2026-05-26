/**
 * Data layer – loads JSON files and merges with localStorage tracking
 */
const Data = (() => {
  let _items    = [];
  let _analysis = [];

  async function load() {
    const [items, analysis] = await Promise.all([
      fetch('./data/regulatory_items.json').then(r => r.json()).catch(() => []),
      fetch('./data/ai_analysis.json').then(r => r.json()).catch(() => []),
    ]);
    _items    = items;
    _analysis = analysis;
    return { items, analysis };
  }

  function items()    { return _items; }
  function analysis() { return _analysis; }

  function analysisFor(itemId) {
    return _analysis.find(a => a.item_id === itemId) || null;
  }

  function itemById(id) {
    return _items.find(i => i.id === id) || null;
  }

  /** Merge item + analysis + tracking into a single object */
  function enriched(filters = {}) {
    return _items
      .map(item => {
        const a = analysisFor(item.id) || {};
        const t = Tracking.get(item.id) || {};
        return { ...item, ...a, ...t, _item: item, _analysis: a, _tracking: t };
      })
      .filter(row => {
        if (filters.country && row.country !== filters.country) return false;
        if (filters.status  && row.status  !== filters.status)  return false;
        if (filters.risk    && row.risk_level !== filters.risk)  return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!row.title?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
  }

  function stats() {
    const rows = enriched();
    const today = new Date().toISOString().slice(0, 10);
    const in7d  = new Date(Date.now() + 7*864e5).toISOString().slice(0, 10);

    const byCountry   = {};
    const byRegulator = {};
    const byCategory  = {};

    rows.forEach(r => {
      byCountry[r.country]   = (byCountry[r.country]   || 0) + 1;
      byRegulator[r.regulator] = (byRegulator[r.regulator] || 0) + 1;
      if (r.thematic_classification)
        byCategory[r.thematic_classification] = (byCategory[r.thematic_classification] || 0) + 1;
    });

    const sortedReg = Object.entries(byRegulator).sort((a,b) => b[1]-a[1]).slice(0,8);

    const tracking = rows.map(r => Tracking.get(r.id)).filter(Boolean);

    return {
      total:         rows.length,
      nuevo:         rows.filter(r => r.status === 'nuevo').length,
      applicable:    rows.filter(r => ['aplica_informativo','aplica_requiere_accion'].includes(r.status)).length,
      critical:      rows.filter(r => r.risk_level === 'crítico').length,
      expired:       rows.filter(r => r.status === 'vencido').length,
      expiring_soon: tracking.filter(t => t.due_date && t.due_date >= today && t.due_date <= in7d && !['implementado','cerrado'].includes(t.progress_status)).length,
      byCountry,
      byRegulator: Object.fromEntries(sortedReg),
      byCategory,
    };
  }

  return { load, items, analysis, analysisFor, itemById, enriched, stats };
})();
