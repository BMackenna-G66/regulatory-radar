const Export = (() => {
  function _filtered() {
    const entity  = document.getElementById('exp-entity')?.value  || '';
    const status  = document.getElementById('exp-status')?.value  || '';
    const risk    = document.getElementById('exp-risk')?.value    || '';
    return Data.enriched({
      entity:             entity || undefined,
      impl:               status || undefined,
      risk_consolidated:  risk   || undefined,
    });
  }

  function updatePreview() {
    const rows = _filtered();
    const el = document.getElementById('export-preview');
    if (el) el.textContent = `Se exportaran ${rows.length} norma${rows.length !== 1 ? 's' : ''}.`;
  }

  function downloadNormogram() {
    const rows = _filtered();
    if (!rows.length) { App.toast('No hay datos para exportar', 'error'); return; }

    const COLS = [
      'N°','Pais','Entidad Aplicable','Categoria Normativa','Nombre de la Norma',
      'N° / Identificador','Fecha Publicacion','Fecha Vigencia','Autoridad Emisora',
      'Estado','Materia Regulada','Resumen Ejecutivo','Obligaciones Principales para Global66',
      'Area Responsable Interna','Impacto Legal','Impacto Operacional','Impacto Tecnologico',
      'Impacto AML/CFT','Impacto en Clientes','Nivel de Riesgo Consolidado',
      'Acciones Requeridas','Fecha Limite Implementacion','Estado de Implementacion',
      'Evidencia de Cumplimiento Esperada','Link Fuente Oficial','Observaciones',
      'Fecha Ultima Revision','Responsable de Actualizacion',
    ];

    const data = [COLS, ...rows.map(r => [
      r.id, r.country, r.entity_applicable, r.document_type, r.title,
      r.identifier, r.publication_date, r.effective_date, r.regulator,
      r.norm_state, r.regulated_subject, r.executive_summary, r.main_obligations,
      r.responsible_area, r.impact_legal, r.impact_operational, r.impact_technological,
      r.impact_aml_cft, r.impact_customer, r.risk_consolidated,
      r.required_actions, r.implementation_deadline, r.implementation_status,
      r.expected_evidence, r.source_url, r.observations,
      r.last_review_date, r.responsible_update,
    ])];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      {wch:5},{wch:8},{wch:16},{wch:16},{wch:50},{wch:18},{wch:12},{wch:20},{wch:18},
      {wch:10},{wch:28},{wch:60},{wch:60},{wch:22},{wch:8},{wch:12},{wch:12},
      {wch:10},{wch:10},{wch:8},{wch:50},{wch:18},{wch:16},{wch:40},{wch:30},{wch:40},
      {wch:14},{wch:22},
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Normograma Chile');

    const filename = `Normograma_Chile_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    App.toast(`Normograma descargado: ${filename}`, 'success');
  }

  function downloadBitacora() {
    const rows = _filtered();
    if (!rows.length) { App.toast('No hay datos para exportar', 'error'); return; }

    const COLS = [
      'N°','Fecha','Circular / Norma','Identificador','Regulador','Entidad',
      'Descripcion','Fecha Recibido','Fecha de Aplicacion','Aplica?','Area Relacionada',
      'Encargado','Comentario','Estado Impl.','Seguimiento','Evidencia',
    ];

    const data = [COLS, ...rows.map((r, idx) => {
      const t = Tracking.get(r.id) || {};
      return [
        idx + 1, r.publication_date || r.detected_at?.slice(0,10) || '',
        r.title || '', r.identifier || '', r.regulator || '', r.entity_applicable || '',
        r.executive_summary || r.regulated_subject || '',
        r.detected_at?.slice(0,10) || '', t.due_date || r.implementation_deadline || '',
        t.applies || (r.implementation_status !== 'N/A' ? 'Si' : 'No'),
        t.responsible_area || r.responsible_area || '',
        t.owner || '', t.comments || '',
        r.implementation_status || '', t.action_plan || '', t.evidence_url || '',
      ];
    })];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      {wch:5},{wch:12},{wch:50},{wch:18},{wch:18},{wch:16},
      {wch:60},{wch:14},{wch:18},{wch:8},{wch:18},{wch:18},{wch:30},{wch:14},{wch:40},{wch:30},
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Bitacora Regulatoria');

    const filename = `Bitacora_Regulatoria_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    App.toast(`Bitacora descargada: ${filename}`, 'success');
  }

  document.addEventListener('change', e => {
    if (['exp-entity','exp-status','exp-risk'].includes(e.target.id)) updatePreview();
  });

  return { downloadNormogram, downloadBitacora, updatePreview };
})();
