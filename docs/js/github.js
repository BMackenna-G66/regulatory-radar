/**
 * GitHub Actions integration — trigger scraping on demand
 * Config stored in localStorage: rr_github_config { owner, repo, token }
 */
const GitHub = (() => {
  const CFG_KEY   = 'rr_github_config';
  const WORKFLOW  = 'scrape.yml';
  const GH_API    = 'https://api.github.com';

  let _pollTimer  = null;
  let _polling    = false;

  // ── Config ──────────────────────────────────────────────────────────────
  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function saveConfig(owner, repo, token) {
    localStorage.setItem(CFG_KEY, JSON.stringify({ owner, repo, token }));
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c && c.owner && c.repo && c.token);
  }

  // ── API helpers ──────────────────────────────────────────────────────────
  async function _ghFetch(path, opts = {}) {
    const { token } = getConfig() || {};
    const res = await fetch(`${GH_API}${path}`, {
      ...opts,
      headers: {
        'Accept':               'application/vnd.github+json',
        'Authorization':        `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // ── Trigger ──────────────────────────────────────────────────────────────
  async function triggerScraping() {
    if (!isConfigured()) { openConfigModal(); return; }
    const { owner, repo } = getConfig();

    _setTriggerLoading(true);
    try {
      await _ghFetch(`/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main' }),
      });
      App.toast('Scraping iniciado — los datos se actualizarán en ~3 min', 'success');
      _setWorkflowBanner('running', 'Scraping en curso…');
      _startPolling();
    } catch (e) {
      App.toast(`Error al disparar scraping: ${e.message}`, 'error');
      if (e.message.includes('401') || e.message.includes('Bad credentials')) {
        App.toast('Token inválido. Reconfigura el acceso.', 'error');
      }
    } finally {
      _setTriggerLoading(false);
    }
  }

  // ── Polling ──────────────────────────────────────────────────────────────
  function _startPolling() {
    if (_polling) return;
    _polling = true;
    let attempts = 0;
    const MAX = 20; // 20 × 30s = 10 min max

    _pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > MAX) { _stopPolling(); return; }
      try {
        const run = await getLastRun();
        if (!run) return;
        if (run.status === 'completed') {
          _stopPolling();
          if (run.conclusion === 'success') {
            _setWorkflowBanner('success', `Completado — ${_relTime(run.updated_at)}`);
            App.toast('Scraping completado. Haz clic en "Actualizar datos" para ver las novedades.', 'success');
          } else {
            _setWorkflowBanner('error', `Falló (${run.conclusion})`);
            App.toast(`El scraping terminó con error: ${run.conclusion}`, 'error');
          }
        } else {
          _setWorkflowBanner('running', `En curso — ${run.status}…`);
        }
      } catch (_) { /* ignore poll errors */ }
    }, 30000);
  }

  function _stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    _polling = false;
    _setTriggerLoading(false);
  }

  // ── Check last run ────────────────────────────────────────────────────────
  async function getLastRun() {
    if (!isConfigured()) return null;
    const { owner, repo } = getConfig();
    const data = await _ghFetch(`/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`);
    return data?.workflow_runs?.[0] || null;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function _setTriggerLoading(loading) {
    document.querySelectorAll('.gh-trigger-btn').forEach(btn => {
      btn.disabled = loading;
      btn.textContent = loading ? '⏳ Iniciando…' : '🔄 Actualizar fuentes';
    });
  }

  function _setWorkflowBanner(type, msg) {
    const banners = document.querySelectorAll('.workflow-status-banner');
    const colors  = { running: '#1e5fbc', success: '#1a7a3e', error: '#c0392b' };
    const icons   = { running: '⏳', success: '✅', error: '❌' };
    banners.forEach(b => {
      b.style.display    = '';
      b.style.background = (colors[type] || '#5a6880') + '18';
      b.style.borderColor= colors[type]  || '#5a6880';
      b.style.color      = colors[type]  || '#5a6880';
      b.textContent      = `${icons[type] || 'ℹ'} ${msg}`;
    });
  }

  function _relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso), now = new Date();
    const m = Math.round((now - d) / 60000);
    return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m}m` : `hace ${Math.floor(m/60)}h`;
  }

  // ── Config modal ──────────────────────────────────────────────────────────
  function openConfigModal() {
    const cfg = getConfig() || {};
    document.getElementById('gh-owner').value = cfg.owner || '';
    document.getElementById('gh-repo').value  = cfg.repo  || '';
    document.getElementById('gh-token').value = cfg.token || '';
    document.getElementById('modal-github-config').style.display = '';
  }

  function closeConfigModal() {
    document.getElementById('modal-github-config').style.display = 'none';
  }

  function saveConfigFromModal() {
    const owner = document.getElementById('gh-owner').value.trim();
    const repo  = document.getElementById('gh-repo').value.trim();
    const token = document.getElementById('gh-token').value.trim();
    if (!owner || !repo || !token) {
      App.toast('Completa todos los campos', 'error'); return;
    }
    saveConfig(owner, repo, token);
    closeConfigModal();
    App.toast('Configuración guardada', 'success');
  }

  // ── Init — check status on load ───────────────────────────────────────────
  async function init() {
    if (!isConfigured()) return;
    try {
      const run = await getLastRun();
      if (!run) return;
      if (run.status === 'in_progress' || run.status === 'queued') {
        _setWorkflowBanner('running', `Scraping en curso — iniciado ${_relTime(run.created_at)}`);
        _startPolling();
      } else if (run.status === 'completed') {
        const msg = run.conclusion === 'success'
          ? `Último scraping exitoso — ${_relTime(run.updated_at)}`
          : `Último scraping falló (${run.conclusion}) — ${_relTime(run.updated_at)}`;
        _setWorkflowBanner(run.conclusion === 'success' ? 'success' : 'error', msg);
      }
    } catch (_) { /* no token or network error — silencioso */ }
  }

  return {
    isConfigured, getConfig,
    triggerScraping,
    getLastRun,
    openConfigModal, closeConfigModal, saveConfigFromModal,
    init,
  };
})();
