const Report = (() => {
  function render() {
    const cats  = Data.categories();
    const items = Data.enriched();
    const today = new Date();
    const period = today.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    const periodEl = document.getElementById('report-period');
    if (periodEl) periodEl.textContent = period.charAt(0).toUpperCase() + period.slice(1);

    _renderKPIs(items);
    _renderTrafficLight(cats, items);
  }

  function _renderKPIs(items) {
    const kpisEl = document.getElementById('report-kpis');
    if (!kpisEl) return;
    const total  = items.length;
    const alto   = items.filter(i => i.risk_consolidated === 'ALTO').length;
    const impl   = items.filter(i => i.implementation_status === 'Implementado').length;
    const enProc = items.filter(i => i.implementation_status === 'En Proceso').length;

    kpisEl.innerHTML = [
      { label: 'Total normativas',  value: total,  sub: 'en el normograma',   cls: 'azul' },
      { label: 'Riesgo ALTO',       value: alto,   sub: `${Math.round(alto/total*100)}%`, cls: 'critico' },
      { label: 'Implementadas',     value: impl,   sub: `${Math.round(impl/total*100)}% cumplimiento`, cls: 'verde' },
      { label: 'En proceso',        value: enProc, sub: 'requieren accion',    cls: '' },
    ].map(k => `<div class="kpi-card ${k.cls}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${k.sub}</div>
      </div>`).join('');
  }

  function _renderTrafficLight(cats, items) {
    const tbody = document.getElementById('report-tbody');
    if (!tbody) return;

    if (!cats.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;">Sin categorias disponibles</td></tr>';
      return;
    }

    const RISK_CLS  = { 'ALTO': 'critico', 'MEDIO': 'alto', 'BAJO': 'bajo' };
    const PRIO_NEXT = {
      'INMEDIATA':    '30/06/2026',
      'CORTO PLAZO':  '31/12/2026',
      'MEDIANO PLAZO':'30/06/2027',
      'LARGO PLAZO':  '31/12/2027',
    };

    tbody.innerHTML = cats.map(cat => {
      const riskCls   = RISK_CLS[cat.risk_level] || 'bajo';
      const normCount = cat.norm_count || 0;

      // Derive from items with matching subject
      const catItems = items.filter(i => {
        const subj = (i.regulated_subject || '').toLowerCase();
        const name = (cat.name || '').toLowerCase();
        return subj.includes(name.slice(0,5)) || (i.thematic_classification || '').includes(cat.name || '');
      });
      const pendientes = catItems.filter(i => i.implementation_status === 'En Proceso').length;
      const brechas    = catItems.filter(i => i.implementation_status === 'Pendiente').length;

      const estado = brechas > 0 ? 'Con brechas' : pendientes > 0 ? 'En proceso' : 'Implementado';
      const estadoCls = brechas > 0 ? 'critico' : pendientes > 0 ? 'alto' : 'implementado';
      const nextDate  = PRIO_NEXT[cat.monitoring_priority] || '—';

      const comment = brechas > 0
        ? `${brechas} norma(s) pendiente(s). Prioridad maxima.`
        : pendientes > 0
          ? `${pendientes} norma(s) en implementacion. Seguimiento activo.`
          : 'Sin novedades. Monitoreo regular continua.';

      return `<tr>
        <td style="font-weight:600;font-size:.84rem;">${cat.name}</td>
        <td><span class="badge badge-${riskCls}" style="font-size:.68rem;">${cat.risk_level || '—'}</span></td>
        <td><span class="badge badge-${estadoCls}" style="font-size:.68rem;">${estado}</span></td>
        <td style="text-align:center;font-weight:600;">${normCount}</td>
        <td style="text-align:center;font-weight:600;color:${brechas > 0 ? 'var(--critico)' : '#94a3b8'};">${brechas}</td>
        <td style="text-align:center;font-weight:600;color:${pendientes > 0 ? 'var(--alto)' : '#94a3b8'};">${pendientes}</td>
        <td style="font-size:.78rem;white-space:nowrap;">${nextDate}</td>
        <td style="font-size:.78rem;color:#5a6880;">${comment}</td>
      </tr>`;
    }).join('');
  }

  function downloadExcel() {
    const cats  = Data.categories();
    const items = Data.enriched();
    const today = new Date().toISOString().slice(0, 10);

    const PRIO_NEXT = {
      'INMEDIATA': '30/06/2026', 'CORTO PLAZO': '31/12/2026',
      'MEDIANO PLAZO': '30/06/2027', 'LARGO PLAZO': '31/12/2027',
    };

    const headers = ['Categoria Normativa','Riesgo','Estado General','Normas Vigentes','Brechas','Acciones Pendientes','Proxima Fecha Limite','Comentario Ejecutivo'];
    const data = [headers];

    cats.forEach(cat => {
      const catItems  = items.filter(i => (i.thematic_classification || '').includes(cat.name || ''));
      const pendientes = catItems.filter(i => i.implementation_status === 'En Proceso').length;
      const brechas    = catItems.filter(i => i.implementation_status === 'Pendiente').length;
      const estado = brechas > 0 ? 'Con brechas' : pendientes > 0 ? 'En proceso' : 'Implementado';
      const comment = brechas > 0
        ? `${brechas} norma(s) pendiente(s). Prioridad maxima.`
        : pendientes > 0 ? `${pendientes} norma(s) en implementacion.` : 'Sin novedades.';
      data.push([cat.name, cat.risk_level, estado, cat.norm_count, brechas, pendientes, PRIO_NEXT[cat.monitoring_priority] || '—', comment]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:28},{wch:8},{wch:15},{wch:8},{wch:8},{wch:10},{wch:16},{wch:50}];
    XLSX.utils.book_append_sheet(wb, ws, 'Semaforo Cumplimiento');

    // Add normogram summary sheet
    const normHeaders = ['N°','Nombre','Identificador','Entidad','Regulador','Riesgo','Estado Impl.','Fecha Limite'];
    const normData = [normHeaders, ...items.map(r => [
      r.id, r.title, r.identifier, r.entity_applicable, r.regulator,
      r.risk_consolidated, r.implementation_status, r.implementation_deadline,
    ])];
    const ws2 = XLSX.utils.aoa_to_sheet(normData);
    ws2['!cols'] = [{wch:5},{wch:50},{wch:18},{wch:16},{wch:18},{wch:8},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Normograma Resumen');

    const filename = `Reporte_Compliance_${today}.xlsx`;
    XLSX.writeFile(wb, filename);
    App.toast(`Reporte descargado: ${filename}`, 'success');
  }

  return { render, downloadExcel };
})();
