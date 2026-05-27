# Radar Regulatorio — Guía para Claude

## ¿Qué es este proyecto?

SPA de compliance regulatorio para fintech operando en Chile. Monitorea automáticamente fuentes regulatorias (CMF, UAF, BCCh, Diario Oficial, etc.), analiza normativas con IA, y permite el seguimiento de implementación por parte del equipo de Compliance.

**Stack:** GitHub Pages (vanilla JS) + Python (GitHub Actions) + Anthropic Claude API

**URL de producción:** `https://YOUR_GITHUB_USERNAME.github.io/regulatory-radar/`

---

## Estructura de carpetas

```
regulatory-radar/
├── docs/                          ← GitHub Pages (SPA frontend)
│   ├── index.html                 ← HTML único con 9 páginas (hash routing)
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js                 ← Router, init, toast, navegación
│   │   ├── data.js                ← Carga JSON, enriquece, filtra, stats
│   │   ├── dashboard.js           ← KPIs + 4 charts (Chart.js)
│   │   ├── inbox.js               ← Bandeja filtrable (normativas)
│   │   ├── detail.js              ← Detalle + 4 tabs + matriz impacto 5D
│   │   ├── tracking.js            ← Seguimiento (localStorage)
│   │   ├── categories.js          ← Grid de 20 categorías normativas
│   │   ├── sources.js             ← Tabla fuentes + estado scraping
│   │   ├── changes.js             ← Registro de cambios (localStorage CRUD)
│   │   ├── alerts.js              ← Alertas regulatorias (localStorage CRUD)
│   │   ├── report.js              ← Reporte mensual + semáforo + Excel
│   │   └── export.js              ← Exportar normograma 28-col + bitácora
│   └── data/
│       ├── regulatory_items.json  ← Normativas (28 campos, T3 schema)
│       ├── ai_analysis.json       ← Análisis IA por item_id
│       ├── sources.json           ← 20 fuentes regulatorias
│       ├── categories.json        ← 20 categorías normativas
│       ├── changes.json           ← Cambios normativos (seed)
│       └── sources_status.json    ← Estado último scraping por fuente
│
├── scripts/
│   ├── scraper.py                 ← 9 scrapers activos + dedup + status
│   ├── analyzer.py                ← Análisis Claude API + fallback reglas
│   ├── scoring.py                 ← Score determinístico 0–100
│   └── requirements.txt
│
├── .github/workflows/
│   ├── scrape.yml                 ← L–V 09:00 UTC
│   └── analyze.yml                ← Se dispara al terminar scraping
│
├── config/sources.yaml
├── project-info/                  ← Documentación completa del proyecto
│   ├── SETUP.md
│   ├── SCHEMA.md
│   └── MODULES.md
└── CLAUDE.md                      ← Este archivo
```

---

## Módulos JS — comportamiento esperado

| Módulo | Patrón |
|--------|--------|
| `App` | IIFE; `navigate(page)`, `navigateDetail(id)`, `reload()`, `toast(msg, type)` |
| `Data` | IIFE async; `load()` → Promise; `enriched(filters)`, `stats()`, `sources()`, `categories()` |
| `Tracking` | IIFE; `localStorage` key `rr_tracking_v1`; `get(id)`, `save(id, data)` |
| `Changes` | IIFE; `localStorage` key `rr_changes_v1`; seed desde `changes.json` |
| `Alerts` | IIFE; `localStorage` key `rr_alerts_v1` |
| `Report` | IIFE; `render()`, `downloadExcel()` via SheetJS |
| `Export` | IIFE; `downloadNormogram()` (28 cols), `downloadBitacora()` (tracking) |

**CDN dependencias (en index.html):**
- Chart.js 4.4.2
- SheetJS (xlsx) 0.18.5
- Google Fonts (Inter)

---

## Schema de normativas (28 campos)

Ver `project-info/SCHEMA.md` para el detalle completo.

Campos clave:
- `id` — entero autoincremental
- `entity_applicable` — `"Global Card S.A."` | `"Global 81 SpA"` | `"Ambas"`
- `risk_consolidated` — `"ALTO"` | `"MEDIO"` | `"BAJO"`
- `implementation_status` — `"Implementado"` | `"En Proceso"` | `"Pendiente"` | `"N/A"`
- `impact_legal/operational/technological/aml_cft/customer` — `"ALTO"` | `"MEDIO"` | `"BAJO"` | `null`

---

## Filtros disponibles en `Data.enriched()`

```js
Data.enriched({
  entity,       // "Global Card S.A." | "Global 81 SpA" | "Ambas"
  regulator,    // string exacto
  doctype,      // string exacto
  risk,         // risk_level del análisis: "crítico" | "alto" | "medio" | "bajo"
  impl,         // implementation_status
  risk_consolidated, // "ALTO" | "MEDIO" | "BAJO"
  status,       // status legacy
  category,     // thematic_classification
  search,       // busca en title + identifier + regulated_subject + regulator
})
```

---

## Scraper — fuentes activas

| Key en sources_status.json | Función |
|---------------------------|---------|
| `CMF` | scrape_cmf() |
| `UAF` | scrape_uaf() |
| `Banco Central de Chile` | scrape_bcch() |
| `Diario Oficial` | scrape_diario_oficial() |
| `SERNAC` | scrape_sernac() |
| `Congreso Nacional` | scrape_congreso() |
| `OFAC / GAFI` | scrape_ofac() |
| `GAFI / GAFILAT` | scrape_fatf_gafilat() |
| `Agencia de Datos` | scrape_agencia_datos() |

Deduplicación via `content_hash` (SHA-256 del título normalizado). IDs autoincremental partiendo del máximo existente.

---

## Variables de entorno necesarias

```
ANTHROPIC_API_KEY   ← Requerida para analyzer.py (fallback sin clave: reglas determinísticas)
```

GitHub Secret en: `Settings → Secrets → Actions → ANTHROPIC_API_KEY`

---

## Convenciones CSS

- Variables en `:root`: `--blue`, `--critico`, `--alto`, `--bajo`, `--verde`
- Clases badge: `badge-critico`, `badge-alto`, `badge-bajo`, `badge-implementado`, `badge-nuevo`, `badge-aplica_requiere_accion`, `badge-no_aplica`
- Páginas: `<div class="page" id="page-{nombre}">` — visibilidad via `display:none/block`
- Nav: `<a class="nav-link" data-page="{nombre}">`

---

## Flujo para agregar una nueva vista

1. Agregar `<div class="page" id="page-NOMBRE">` en `index.html`
2. Agregar `<a class="nav-link" data-page="NOMBRE">` en el nav
3. Crear `docs/js/NOMBRE.js` con IIFE exportando `{ render }`
4. Agregar `<script src="./js/NOMBRE.js">` en index.html
5. Registrar en `App.PAGES` en `app.js`

---

## Correr localmente

```bash
cd docs
python3 -m http.server 8080
# → http://localhost:8080
```

No requiere build step. Todo es vanilla JS + fetch de JSONs locales.
