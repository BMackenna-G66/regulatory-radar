/**
 * Excel export using SheetJS
 */
const Export = (() => {
  const COLUMNS = [
    'No.','Fecha','Circular / Norma','Fuente / Anexos','Descripción',
    'Fecha Recibido','Fecha de Aplicación','¿Aplica?','Área Relacionada',
    'Encargado Área','Comentario','Estado','Seguimiento',
  ];

  const STATUS_LABEL = {
    nuevo:'Nuevo', en_revision:'En revisión', no_aplica:'No aplica',
    aplica_informativo:'Aplica (info)', aplica_requiere_accion:'Aplica (acción)',
    implementado:'Implementado', vencido:'Vencido',
  };

  function _filtered() {
    const country = document.getElementById('exp-country')?.value || '';
    const status  = document.getElementById('exp-status')?.value  || '';
    return Data.enriched({ country: country || undefined, status: status || undefined });
  }

  function updatePreview() {
    const rows = _filtered();
    const el = document.getElementById('export-preview');
    if (el) el.textContent = `Se exportarán ${rows.length} norma${rows.length !== 1 ? 's' : ''}.`;
  }

  function downloadExcel() {
    const rows = _filtered();
    if (!rows.length) { App.toast('No hay datos para exportar', 'error'); return; }

    const data = [COLUMNS];
    rows.forEach((r, idx) => {
      const t = Tracking.get(r.id) || {};
      data.push([
        idx + 1,
        r.publication_date || r.detected_at?.slice(0,10) || '',
        r.title || '',
        r.source_url || '',
        r.executive_summary || '',
        r.detected_at?.slice(0,10) || '',
        t.due_date || r.max_application_date || '',
        t.applies || r.applies || '',
        t.responsible_area || r.suggested_area || '',
        t.owner || '',
        t.comments || '',
        STATUS_LABEL[r.status] || r.status || '',
        t.action_plan || '',
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      {wch:5},{wch:12},{wch:50},{wch:40},{wch:60},
      {wch:14},{wch:18},{wch:10},{wch:18},{wch:18},
      {wch:30},{wch:18},{wch:40},
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Bitácora Regulatoria');

    const filename = `Bitacora_Regulatoria_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    App.toast(`Excel descargado: ${filename}`, 'success');
  }

  // Live preview update on filter change
  document.addEventListener('change', e => {
    if (e.target.id === 'exp-country' || e.target.id === 'exp-status') updatePreview();
  });

  return { downloadExcel, updatePreview };
})();
