/**
 * Deleted — eliminación (soft delete) de normativas / noticias detectadas.
 *
 * Fuente compartida : docs/data/deleted_items.json  (se commitea vía GitHub API)
 * Overlay local     : localStorage rr_deleted_v1 = { add: {id: entry}, remove: [id] }
 *   - Permite que el borrado se vea al instante, aunque GitHub Pages tarde en
 *     redeployar o el navegador no tenga token configurado.
 *   - Se autolimpia cuando el JSON remoto ya refleja el cambio.
 *
 * Los ítems eliminados NO se borran de regulatory_items.json: se ocultan en
 * todas las vistas y el scraper/analyzer los ignoran (por content_hash / id).
 * Las normativas manuales (id >= 10000, solo localStorage) se borran en duro.
 */
const Deleted = (() => {
  const LOCAL_KEY = 'rr_deleted_v1';
  const FILE_PATH = 'docs/data/deleted_items.json';
  const MANUAL_MIN_ID = 10000;

  let _remote = [];

  // ── Overlay local ────────────────────────────────────────────────────────
  // { add, remove }            → cambios aún NO subidos a GitHub
  // committed: { add, remove, at } → ya subidos, a la espera de que GitHub Pages
  //                                  redespliegue (evita que reaparezcan ~1 min)
  function _getLocal() {
    try {
      const o = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') || {};
      const c = o.committed || {};
      return {
        add: o.add || {}, remove: o.remove || [],
        committed: { add: c.add || {}, remove: c.remove || [], at: c.at || 0 },
      };
    } catch (_) { return { add: {}, remove: [], committed: { add: {}, remove: [], at: 0 } }; }
  }

  function _saveLocal(o) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(o));
  }

  function _applyOps(list, ops) {
    const byId = new Map(list.map(e => [e.id, e]));
    Object.values(ops.add).forEach(e => byId.set(e.id, e));
    ops.remove.forEach(id => byId.delete(id));
    return [...byId.values()].sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || ''));
  }

  // Quita del overlay lo que el remoto ya refleja
  function _cleanLocal() {
    const o = _getLocal();
    const remoteIds = new Set(_remote.map(e => e.id));
    const prune = ops => {
      Object.keys(ops.add).forEach(k => { if (remoteIds.has(Number(k))) delete ops.add[k]; });
      ops.remove = ops.remove.filter(id => remoteIds.has(id));
    };
    prune(o);
    prune(o.committed);
    // Pasada 1 h, el JSON publicado manda (p. ej. alguien restauró desde otro equipo)
    if (Date.now() - o.committed.at > 3600e3) o.committed = { add: {}, remove: [], at: 0 };
    _saveLocal(o);
  }

  function _merged(list) {
    const o = _getLocal();
    return _applyOps(_applyOps(list, o.committed), o);
  }

  // ── Carga ────────────────────────────────────────────────────────────────
  async function load() {
    _remote = await fetch(`./data/deleted_items.json?t=${Date.now()}`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
    if (!Array.isArray(_remote)) _remote = [];
    _cleanLocal();
    return _remote;
  }

  function entries() { return _merged(_remote); }

  function _idSet() { return new Set(entries().map(e => e.id)); }

  function isDeleted(id) { return _idSet().has(id); }

  function pendingCount() {
    const o = _getLocal();
    return Object.keys(o.add).length + o.remove.length;
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  /**
   * @param {number[]} ids
   * @param {{skipConfirm?: boolean}} opts
   * @returns {Promise<boolean>} true si se eliminó algo
   */
  async function remove(ids, opts = {}) {
    ids = [...new Set(ids)].filter(Number.isFinite);
    if (!ids.length) return false;

    const items  = ids.map(id => Data.itemById(id)).filter(Boolean);
    const manual = items.filter(i => i._manual || i.id >= MANUAL_MIN_ID);
    const scraped = items.filter(i => !(i._manual || i.id >= MANUAL_MIN_ID));

    if (!opts.skipConfirm) {
      const label = items.length === 1
        ? `"${(items[0].title || '').slice(0, 90)}"`
        : `${items.length} elementos`;
      const extra = manual.length
        ? `\n\n${manual.length === items.length ? 'Es una normativa manual: se borrará definitivamente.' : `${manual.length} son manuales y se borrarán definitivamente.`}`
        : '\n\nPodrás restaurarlo desde la Papelera. El scraper no lo volverá a agregar.';
      if (!confirm(`¿Eliminar ${label}?${extra}`)) return false;
    }

    let reason = '';
    if (scraped.length) {
      const r = prompt('Motivo de la eliminación (opcional):', '');
      if (r === null) return false;          // canceló
      reason = r.trim();
    }

    // Manuales → borrado duro en localStorage
    if (manual.length) {
      const mIds = new Set(manual.map(i => i.id));
      const keep = NormativaEditor.getManualItems().filter(i => !mIds.has(i.id));
      localStorage.setItem('rr_manual_items_v1', JSON.stringify(keep));
      const ov = NormativaEditor.getOverrides();
      mIds.forEach(id => delete ov[id]);
      localStorage.setItem('rr_item_overrides_v1', JSON.stringify(ov));
    }

    // Scrapeadas → papelera
    if (scraped.length) {
      const o = _getLocal();
      const now = new Date().toISOString();
      const by  = GitHub.getConfig()?.owner || '';
      scraped.forEach(i => {
        o.add[i.id] = {
          id:               i.id,
          content_hash:     i.content_hash || null,
          title:            i.title || '',
          identifier:       i.identifier || '',
          regulator:        i.regulator || '',
          document_type:    i.document_type || '',
          publication_date: i.publication_date || null,
          source_url:       i.source_url || null,
          reason,
          deleted_at:       now,
          deleted_by:       by,
        };
        o.remove = o.remove.filter(x => x !== i.id);
      });
      _saveLocal(o);
    }

    App.toast(items.length === 1 ? 'Elemento eliminado' : `${items.length} elementos eliminados`, 'success');
    _rerender();
    if (scraped.length) await sync();
    return true;
  }

  // ── Restaurar ────────────────────────────────────────────────────────────
  async function restore(id) {
    const o = _getLocal();
    delete o.add[id];
    const published = _applyOps(_remote, o.committed).some(e => e.id === id);
    if (published && !o.remove.includes(id)) o.remove.push(id);
    _saveLocal(o);
    App.toast('Elemento restaurado', 'success');
    _rerender();
    renderTrash();
    await sync();
  }

  // ── Sync con GitHub (Contents API) ───────────────────────────────────────
  function _b64decode(s) {
    const bin = atob((s || '').replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  function _b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  let _syncing = false;

  async function sync(attempt = 1) {
    if (!pendingCount()) return true;
    if (!GitHub.isConfigured()) {
      App.toast('Eliminado solo en este navegador. Configura el acceso a GitHub (⚙) para que aplique a todo el equipo.', 'info');
      _renderSyncStatus();
      return false;
    }
    if (_syncing) return false;
    _syncing = true;
    const { owner, repo, token } = GitHub.getConfig();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`;
    const headers = {
      'Accept':               'application/vnd.github+json',
      'Authorization':        `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    try {
      // 1. Leer versión actual del archivo en main
      let sha, current = [];
      const getRes = await fetch(`${url}?ref=main`, { headers, cache: 'no-store' });
      if (getRes.ok) {
        const f = await getRes.json();
        sha = f.sha;
        try { current = JSON.parse(_b64decode(f.content) || '[]'); } catch (_) { current = []; }
      } else if (getRes.status !== 404) {
        throw new Error((await getRes.json().catch(() => ({}))).message || `HTTP ${getRes.status}`);
      }

      // 2. Aplicar cambios locales y escribir
      const o = _getLocal();
      const next = _applyOps(Array.isArray(current) ? current : [], o);
      const nAdd = Object.keys(o.add).length, nRem = o.remove.length;
      const msg = `data: papelera — ${[nAdd && `elimina ${nAdd}`, nRem && `restaura ${nRem}`].filter(Boolean).join(', ')} [dashboard]`;

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          content: _b64encode(JSON.stringify(next, null, 2) + '\n'),
          branch:  'main',
          ...(sha ? { sha } : {}),
        }),
      });
      if ((putRes.status === 409 || putRes.status === 422) && attempt < 3) {
        _syncing = false;
        return sync(attempt + 1);         // conflicto de sha → reintentar
      }
      if (!putRes.ok) {
        throw new Error((await putRes.json().catch(() => ({}))).message || `HTTP ${putRes.status}`);
      }

      // Pasar lo pendiente a "committed" hasta que Pages publique el JSON nuevo
      const after = _getLocal();
      Object.assign(after.committed.add, after.add);
      Object.keys(after.add).forEach(k => {
        after.committed.remove = after.committed.remove.filter(x => x !== Number(k));
      });
      after.remove.forEach(id => {
        delete after.committed.add[id];
        if (!after.committed.remove.includes(id)) after.committed.remove.push(id);
      });
      after.committed.at = Date.now();
      after.add = {}; after.remove = [];
      _saveLocal(after);
      App.toast('Papelera sincronizada con GitHub', 'success');
      return true;
    } catch (e) {
      const hint = /403|404|Resource not accessible|Not Found/i.test(e.message)
        ? ' (el token necesita permiso de escritura en Contents)' : '';
      App.toast(`No se pudo sincronizar con GitHub: ${e.message}${hint}. Quedó guardado en este navegador.`, 'error');
      return false;
    } finally {
      _syncing = false;
      _renderSyncStatus();
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function _rerender() {
    const page = (window.location.hash || '#dashboard').slice(1);
    if (page === 'detail') App.navigate('inbox');
    else App.navigate(page);
    _updateTrashBadges();
  }

  function _updateTrashBadges() {
    const n = entries().length;
    document.querySelectorAll('.trash-count').forEach(el => { el.textContent = n ? `(${n})` : ''; });
  }

  function _renderSyncStatus() {
    const el = document.getElementById('trash-sync-status');
    if (!el) return;
    const p = pendingCount();
    if (!p) { el.innerHTML = '✅ Papelera sincronizada con el repositorio.'; return; }
    el.innerHTML = `⚠ ${p} cambio${p !== 1 ? 's' : ''} solo en este navegador. ` +
      (GitHub.isConfigured()
        ? '<a href="#" onclick="event.preventDefault();Deleted.sync()">Reintentar sincronización</a>'
        : '<a href="#" onclick="event.preventDefault();GitHub.openConfigModal()">Configurar GitHub</a>');
  }

  function renderTrash() {
    const tbody = document.getElementById('trash-tbody');
    if (!tbody) return;
    const list = entries();
    tbody.innerHTML = list.length
      ? list.map(e => `<tr style="cursor:default;">
          <td style="white-space:nowrap;font-size:.75rem;">${_esc((e.deleted_at || '').slice(0, 10))}</td>
          <td style="font-size:.75rem;">${_esc(e.regulator)}</td>
          <td>
            <div style="font-size:.8rem;">${_esc(e.title)}</div>
            <div style="font-size:.7rem;color:#5a6880;">${_esc(e.document_type)} ${e.identifier ? '· ' + _esc(e.identifier) : ''}</div>
          </td>
          <td style="font-size:.75rem;color:#5a6880;">${_esc(e.reason) || '—'}</td>
          <td><button class="btn btn-outline-blue btn-sm" onclick="Deleted.restore(${Number(e.id)})">Restaurar</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">La papelera está vacía</td></tr>';
    _renderSyncStatus();
    _updateTrashBadges();
  }

  function openTrash() {
    renderTrash();
    document.getElementById('modal-trash').style.display = '';
  }

  function closeTrash() {
    document.getElementById('modal-trash').style.display = 'none';
  }

  return {
    load, entries, isDeleted, pendingCount,
    remove, restore, sync,
    openTrash, closeTrash, renderTrash,
    updateBadges: _updateTrashBadges,
  };
})();
