# Documento de Migración — Radar Regulatorio
**Versión:** 1.0 | **Fecha:** Junio 2026 | **Estado:** Producción MVP

> Documentación exhaustiva para reproducir este proyecto en otra cuenta o licencia de Claude sin perder contexto, arquitectura, lógica de negocio ni conocimiento acumulado.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto de negocio](#2-contexto-de-negocio)
3. [Arquitectura general](#3-arquitectura-general)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Estructura de archivos](#5-estructura-de-archivos)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Fuentes de información](#7-fuentes-de-información)
8. [Lógica de negocio](#8-lógica-de-negocio)
9. [Prompts utilizados](#9-prompts-utilizados)
10. [Configuraciones](#10-configuraciones)
11. [Flujos operacionales](#11-flujos-operacionales)
12. [Automatizaciones](#12-automatizaciones)
13. [Dependencias críticas](#13-dependencias-críticas)
14. [Decisiones históricas](#14-decisiones-históricas)
15. [Estado actual](#15-estado-actual)
16. [Roadmap](#16-roadmap)
17. [Checklist de migración](#17-checklist-de-migración)
18. [Prompt Maestro (Contexto para otra IA)](#18-prompt-maestro)
19. [Conocimiento acumulado del chat](#19-conocimiento-acumulado)

---

## 1. Resumen ejecutivo

| Campo | Valor |
|-------|-------|
| **Nombre** | Radar Regulatorio — Plataforma de Monitoreo Regulatorio Automatizado |
| **Repositorio** | `BMackenna-G66/regulatory-radar` |
| **Objetivo** | Automatizar la captura, análisis, clasificación, priorización, seguimiento y reporte de cambios regulatorios en Chile para Global Card S.A. y Global 81 SpA (grupo Global66) |
| **Problema** | El equipo de Compliance revisaba 9+ fuentes regulatorias manualmente ~12 horas/semana con alto riesgo de omitir normativas críticas |
| **Usuarios** | Equipo de Legal & Compliance Chile de Global66 (single-user / small team) |
| **Estado** | Producción — GitHub Pages, scraping automático L-V 09:00 UTC activo |
| **Madurez** | MVP en Producción (v1.0) — listo para uso operacional |

---

## 2. Contexto de negocio

### Entidades reguladas

| Entidad | Rol | Regulador | Marco normativo |
|---------|-----|-----------|----------------|
| **Global Card S.A.** | Emisor tarjetas prepago | CMF | Ley 19.913, Ley Fintech 21.521, NCG CMF |
| **Global 81 SpA** | Operadora pagos/transferencias | BCCh / CMF | Recopilación BCCh, Circulares UAF |

### Casos de uso principales

1. Monitoreo diario automático de 9 fuentes → detección normativas nuevas el mismo día (09:00 UTC)
2. Análisis de impacto con IA (Claude API) → clasificación automática en 10 categorías
3. Gestión de implementación: responsable, fecha límite, estado de avance por normativa
4. Generación de reporte mensual para comités de compliance (semáforo ALTO/MEDIO/BAJO)
5. Exportación normograma 28 cols + bitácora Excel para reguladores
6. Trigger manual de scraping on-demand desde la interfaz web
7. Agregar y editar normativas manualmente (modal 5 tabs, 28 campos)

### Beneficios cuantificados

| Métrica | Antes | Después | Ahorro |
|---------|-------|---------|--------|
| Tiempo revisión semanal | 12 horas | 1 hora | 92% |
| Cobertura fuentes | Variable | 100% consistente | — |
| Tiempo detección norma nueva | 1-7 días | Mismo día | — |

### Riesgos identificados

- ⚠️ Sitios JS-rendered (CMF, BCCh) no scrapean directo → se usan endpoints alternativos
- ⚠️ localStorage es single-browser → no multi-usuario sin backend adicional
- ⚠️ PAT de GitHub almacenado en localStorage → riesgo si se comparte el browser
- ⚠️ GitHub Pages requiere repo público o GitHub Pro

---

## 3. Arquitectura general

```
GitHub Actions (Cron L-V 09:00 UTC)
    │
    ▼
scripts/scraper.py
    → Scraping 9 fuentes (requests + BeautifulSoup)
    → Filtro relevancia (40+ keywords regex)
    → Deduplicación SHA-256 (content_hash)
    → docs/data/regulatory_items.json   (commit)
    → docs/data/sources_status.json     (commit)
    │
    ▼ (dispatcha analyze.yml)
scripts/analyzer.py
    → Claude claude-sonnet-4-6 o fallback reglas
    → docs/data/ai_analysis.json         (commit)
    │
    ▼
GitHub Pages (estático, CDN)
    → docs/index.html (SPA, hash routing)
    → docs/js/*.js    (módulos IIFE vanilla JS)
    → docs/data/*.json (servidos via fetch())
    │
    ▼
Browser del usuario
    → Data.load() fetch 4 JSON al cargar
    → Data.enriched() merge: JSON + localStorage
    → Render de 9 páginas con Chart.js + SheetJS
```

### Flujo completo de información

- **Entrada:** 9 URLs externas → `scraper.py` (filtro + dedup) → `regulatory_items.json` + `sources_status.json`
- **Análisis:** `regulatory_items.json` → `analyzer.py` (Claude API) → `ai_analysis.json`
- **Frontend:** `Data.load()` → 4 fetch() → `Data.enriched()` merge items + analysis + tracking + overrides → 9 módulos de vista
- **Persistencia local:** Tracking, cambios, alertas, items manuales, overrides → `localStorage` (5 keys)

---

## 4. Stack tecnológico

| Capa | Tecnología | Versión | Uso |
|------|-----------|---------|-----|
| Frontend | Vanilla JavaScript | ES6+ | IIFEs, sin bundler |
| Frontend | HTML5 / CSS3 | — | SPA, hash routing, variables CSS |
| Frontend CDN | Chart.js | 4.4.2 | 4 charts en dashboard |
| Frontend CDN | SheetJS (xlsx) | 0.18.5 | Export Excel normograma + bitácora |
| Frontend CDN | Google Fonts (Inter) | — | Tipografía |
| Backend (CI) | Python | 3.11 | Scraper + Analyzer |
| Backend (CI) | requests / BeautifulSoup | ≥2.31 / ≥4.12 | Scraping HTTP |
| Backend (CI) | lxml | ≥5.1.0 | HTML parsing |
| IA | Anthropic SDK | ≥0.28.0 | Claude claude-sonnet-4-6 |
| Hosting | GitHub Pages | — | Branch main, /docs folder |
| CI/CD | GitHub Actions | — | scrape.yml + analyze.yml |
| Almacenamiento | JSON files en repo | — | docs/data/*.json |
| Almacenamiento local | localStorage | — | tracking, manual items, overrides |

---

## 5. Estructura de archivos

```
regulatory-radar/
│
├── CLAUDE.md                    ← Onboarding automático para Claude Code
├── README.md
│
├── docs/                        ← GitHub Pages root (todo lo público)
│   ├── index.html               ← SPA única: 9 páginas, hash routing
│   ├── css/
│   │   └── style.css            ← Estilos con variables CSS
│   ├── js/
│   │   ├── app.js               ← Router, init, toast, navegación
│   │   ├── data.js              ← Carga JSON + merge tracking + manual items
│   │   ├── dashboard.js         ← KPIs + 4 charts Chart.js
│   │   ├── inbox.js             ← Bandeja filtrable de normativas
│   │   ├── detail.js            ← Detalle + 5D matrix + 4 tabs + tracking form
│   │   ├── categories.js        ← Grid 20 categorías normativas
│   │   ├── sources.js           ← Tabla fuentes + estado scraping live
│   │   ├── changes.js           ← Registro cambios CRUD localStorage
│   │   ├── alerts.js            ← Alertas regulatorias CRUD localStorage
│   │   ├── report.js            ← Reporte mensual semáforo + Excel
│   │   ├── export.js            ← Export normograma 28-col + bitácora
│   │   ├── tracking.js          ← Seguimiento implementación localStorage
│   │   ├── github.js            ← GitHub Actions API trigger on-demand
│   │   └── normativa-editor.js  ← CRUD manual normativas (5-tab modal)
│   └── data/
│       ├── regulatory_items.json  ← 59+ normativas (28 campos, schema T3)
│       ├── ai_analysis.json       ← Análisis IA por item_id
│       ├── sources.json           ← 20 fuentes regulatorias (catálogo)
│       ├── categories.json        ← 20 categorías normativas
│       ├── changes.json           ← Seed cambios normativos (11 entradas)
│       └── sources_status.json    ← Estado último scraping por fuente
│
├── scripts/
│   ├── scraper.py               ← 9 scrapers + dedup + relevance filter
│   ├── analyzer.py              ← Claude API analysis + fallback rules
│   ├── scoring.py               ← Score determinístico 0–100
│   └── requirements.txt
│
├── .github/
│   └── workflows/
│       ├── scrape.yml           ← Cron L-V 09:00 UTC + workflow_dispatch
│       └── analyze.yml          ← Se dispara al terminar scraping
│
├── config/
│   └── sources.yaml             ← Fuentes configurables
│
├── project-info/
│   ├── SETUP.md                 ← Guía setup nuevo PC
│   ├── SCHEMA.md                ← Schemas completos de los 6 JSON
│   ├── MODULES.md               ← Documentación módulos JS y Python
│   └── MIGRATION.md             ← Este archivo
│
├── .env.example
└── .gitignore
```

---

## 6. Modelo de datos

### regulatory_items.json — 28 campos (schema T3)

```json
{
  "id":                     1,            // int autoincremental (manual: max(10000)+1)
  "country":                "Chile",
  "entity_applicable":      "Ambas",      // "Global Card S.A." | "Global 81 SpA" | "Ambas"
  "document_type":          "Circular",
  "title":                  "...",        // REQUERIDO
  "identifier":             "NCG 454",
  "publication_date":       "2024-01-15",
  "effective_date":         "2024-03-01", // ISO date | null
  "regulator":              "CMF",        // REQUERIDO
  "norm_state":             "Vigente",    // "Vigente" | "Derogada" | "En consulta"
  "regulated_subject":      "...",
  "executive_summary":      "...",
  "main_obligations":       "...",
  "responsible_area":       "Compliance",
  "impact_legal":           "ALTO",       // "ALTO" | "MEDIO" | "BAJO" | null
  "impact_operational":     "MEDIO",
  "impact_technological":   "BAJO",
  "impact_aml_cft":         "ALTO",
  "impact_customer":        "MEDIO",
  "risk_consolidated":      "ALTO",       // "ALTO" | "MEDIO" | "BAJO" (campo T3 PRINCIPAL)
  "required_actions":       "...",
  "implementation_deadline":"2025-06-30",
  "implementation_status":  "En Proceso", // "Implementado" | "En Proceso" | "Pendiente" | "N/A"
  "expected_evidence":      "...",
  "source_url":             "https://...",
  "observations":           "...",
  "last_review_date":       "2025-05-01",
  "responsible_update":     "Equipo Compliance",
  // Generados automáticamente:
  "status":         "aplica_requiere_accion", // legacy, derivado de implementation_status
  "content_hash":   "abc123...",              // SHA-256(título normalizado)
  "detected_at":    "2025-05-27T09:00:00",
  "_manual":        true                       // solo en items creados manualmente
}
```

**Mapeo implementation_status → status (legacy):**

| implementation_status | status |
|----------------------|--------|
| `Implementado` | `implementado` |
| `En Proceso` | `aplica_requiere_accion` |
| `Pendiente` | `aplica_requiere_accion` |
| `N/A` | `no_aplica` |

### ai_analysis.json

```json
{
  "item_id":                 1,
  "executive_summary":       "...",
  "main_changes":            "...",
  "possible_impact":         "...",
  "affected_areas":          "Compliance, Legal",
  "affected_products":       "...",
  "detected_obligations":    "...",
  "max_application_date":    "2025-06-30",
  "thematic_classification": "AML",
  // AML | KYC | Fraude | Sanciones | PEP | Protección al consumidor
  // Datos personales | Criptoactivos | Tributario | Operacional | Otros
  "risk_score":              75,     // 0-100
  "risk_level":              "alto", // "crítico" | "alto" | "medio" | "bajo"
  "applies":                 "sí",
  "applies_reason":          "...",
  "suggested_area":          "Compliance",
  "criticality":             "alto",
  "recommended_action":      "...",
  "analyzed_at":             "2025-05-27T09:00:00"
}
```

### sources_status.json

> ⚠️ **CRÍTICO:** Los keys deben coincidir exactamente con los strings del array `SCRAPERS` en `scraper.py`

```json
{
  "CMF":                    { "last_checked": "...", "status": "ok", "new_items_found": 2, "total_scraped": 15, "error": null },
  "UAF":                    { ... },
  "Banco Central de Chile": { ... },
  "Diario Oficial":         { ... },
  "SERNAC":                 { ... },
  "Congreso Nacional":      { ... },
  "OFAC / GAFI":            { ... },
  "GAFI / GAFILAT":         { ... },
  "Agencia de Datos":       { ... }
}
```

### localStorage keys

| Key | Módulo | Estructura |
|-----|--------|-----------|
| `rr_manual_items_v1` | NormativaEditor | Array de normativas manuales (id ≥ 10000) |
| `rr_item_overrides_v1` | NormativaEditor | `{[item_id]: {campos modificados}}` |
| `rr_tracking_v1` | Tracking / Detail | `{[item_id]: {owner, due_date, progress_status, ...}}` |
| `rr_changes_v1` | Changes | Array de cambios normativos |
| `rr_alerts_v1` | Alerts | Array de alertas regulatorias |
| `rr_github_config` | GitHub | `{owner, repo, token}` — PAT del usuario |

---

## 7. Fuentes de información

| Key en sources_status.json | Función | Estado | Notas |
|---------------------------|---------|--------|-------|
| `CMF` | `scrape_cmf()` | ⚠️ Parcial | JS-rendered, usa homepage + links estáticos |
| `UAF` | `scrape_uaf()` | ✅ OK | Funciona directo |
| `Banco Central de Chile` | `scrape_bcch()` | ⚠️ Parcial | JS-rendered, endpoints alternativos |
| `Diario Oficial` | `scrape_diario_oficial()` | ✅ OK | Ediciones por fecha |
| `SERNAC` | `scrape_sernac()` | ✅ OK | Funciona |
| `Congreso Nacional` | `scrape_congreso()` | ⚠️ Parcial | DNS falla localmente, OK en Actions |
| `OFAC / GAFI` | `scrape_ofac()` | ✅ OK | ofac.treasury.gov/recent-actions/ |
| `GAFI / GAFILAT` | `scrape_fatf_gafilat()` | ⚠️ Inestable | 404 frecuente, múltiples fallbacks |
| `Agencia de Datos` | `scrape_agencia_datos()` | ⚠️ Parcial | DNS falla localmente, OK en Actions |

Los datos originales del normograma (59+ normativas) provienen de un Excel T3 del equipo de Compliance, cargado manualmente en `regulatory_items.json`.

---

## 8. Lógica de negocio

### Scoring de riesgo — `scoring.py` (determinístico)

```python
_RULES = [
  (30, r"\b(sanci[oó]n|sanciones|multa|multas|incumplimiento|penalidad)\b"),
  (25, r"\b(aml|la[/\-]ft|lavado\s+de\s+dinero|lavado\s+de\s+activos|financiamiento\s+del\s+terrorismo)\b"),
  (20, r"\b(kyc|debida\s+diligencia|identificaci[oó]n\s+de\s+clientes?)\b"),
  (20, r"\b(plazo\s+obligatorio|plazo\s+m[aá]ximo|fecha\s+l[ií]mite|dentro\s+de\s+\d+\s+d[ií]as)\b"),
  (15, r"\b(reporte\s+regulatorio|ros\b|rof\b|reporte\s+de\s+operaciones)\b"),
  (15, r"\b(operaci[oó]n|pagos?|transferencias?|remesas?|clientes|usuarios)\b"),
  (10, r"\b(proyecto\s+de\s+ley|consulta\s+p[uú]blica|propuesta\s+normativa)\b"),
  (10, r"\b(cmf|banco\s+central|superfinanciera|sfc|uaf|uiaf)\b"),
  (-20, r"\b(meramente\s+informativo|solo\s+informativo|car[aá]cter\s+informativo)\b"),
]
# 81–100 → "crítico" → risk_consolidated = "ALTO"
# 61–80  → "alto"    → risk_consolidated = "ALTO"
# 31–60  → "medio"   → risk_consolidated = "MEDIO"
# 0–30   → "bajo"    → risk_consolidated = "BAJO"
```

### Filtro de relevancia — `scraper.py` (40+ keywords)

```python
RELEVANT_KEYWORDS = [
  "fintech","tarjeta","tarjetas","pago","pagos","transferencia","emisor",
  "prepago","billetera","wallet","plataforma de pagos","sistema de pagos",
  "lavado","financiamiento del terrorismo","la/ft","ala/cft","pep","sarlaft",
  "debida diligencia","ros","uaf","beneficiario final","proliferación",
  "activos virtuales","criptoactivos","sanciones ofac",
  "datos personales","protección de datos","ciberseguridad","ley 21.719",
  "consumidor","sernac","protección al consumidor",
  # ... total 40+ keywords
]
RELEVANT_RE = re.compile("|".join(re.escape(k) for k in RELEVANT_KEYWORDS), re.IGNORECASE)
```

### Deduplicación — `scraper.py`

```python
title_norm = re.sub(r'\s+', ' ', title.lower().strip())
content_hash = hashlib.sha256(title_norm.encode()).hexdigest()
# Si content_hash ya existe en los items → skip
```

### Merge de datos — `data.js`

```js
// Data.items() SIEMPRE incluye items de localStorage
function items() {
  const overrides = _getOverrides();   // rr_item_overrides_v1
  const manual    = _getManualItems(); // rr_manual_items_v1
  const base = _items.map(item => {
    const ov = overrides[item.id];
    return ov ? { ...item, ...ov } : item;
  });
  return [...base, ...manual];
}

// Data.enriched() merge completo con análisis y tracking
function enriched(filters = {}) {
  return items()
    .map(item => {
      const a = analysisFor(item.id) || {};
      const t = Tracking.get(item.id) || {};
      return { ...item, ...a, ...t, _item: item, _analysis: a, _tracking: t };
    })
    .filter(/* filtros */)
    .sort(/* por publication_date desc */);
}
```

### Reglas de negocio clave

- Items con `id >= 10000` son manuales — NO eliminar del JSON de GitHub
- `risk_consolidated` = campo T3 del normograma (ALTO/MEDIO/BAJO), es el riesgo que muestra la UI
- `risk_level` = calculado por el analyzer (crítico/alto/medio/bajo), escala diferente
- `implementation_status` = gestión operacional del equipo Compliance
- `norm_state` = estado legal de la norma (Vigente/Derogada/En consulta)

---

## 9. Prompts utilizados

### Prompt principal — `analyzer.py`

- **Nombre:** `USER_PROMPT`
- **Modelo:** `claude-sonnet-4-6` (configurable via `CLAUDE_MODEL` env var)
- **Max tokens:** 1500
- **Fallback:** `rule_based()` si no hay `ANTHROPIC_API_KEY`

**System prompt:**
```
Eres un experto en compliance regulatorio financiero para Latinoamérica.
Analiza documentos regulatorios y extrae información estructurada.
Responde siempre en español.
```

**User prompt (template):**
```
Analiza este documento regulatorio y responde en JSON con estas claves exactas:
{
  "resumen_ejecutivo":        "3-5 oraciones.",
  "principales_cambios":      "Lista de cambios relevantes.",
  "posible_impacto":          "Impacto para empresa fintech/pagos.",
  "areas_afectadas":          "Compliance, Legal, Fraude, Operaciones, Producto, Finanzas, Tecnología, Data, CX.",
  "productos_procesos":       "Productos o procesos afectados.",
  "obligaciones_detectadas":  "Obligaciones concretas.",
  "fecha_maxima_aplicacion":  "Fecha ISO si se menciona, sino null.",
  "clasificacion_tematica":   "UNA de: AML, KYC, Fraude, Sanciones, PEP, Protección al consumidor, Datos personales, Criptoactivos, Tributario, Operacional, Otros"
}

País: {country} | Regulador: {regulator} | Tipo: {document_type}
Título: {title}
Fecha: {publication_date}

Responde SOLO el JSON.
```

---

## 10. Configuraciones

### Variables de entorno

```bash
# GitHub Secret — OBLIGATORIO para analyze.yml
ANTHROPIC_API_KEY=sk-ant-XXXXXXXX

# Opcional — default en analyzer.py es claude-sonnet-4-6
CLAUDE_MODEL=claude-sonnet-4-6

# Solo para desarrollo local
LOG_LEVEL=INFO
```

> El frontend **NO necesita** variables de entorno. Todo es estático.

### GitHub Secrets requeridos

- `ANTHROPIC_API_KEY` → Settings → Secrets → Actions en el repo

### GitHub PAT para trigger on-demand

- **Scope requerido:** `repo` (full control) — **NO** es suficiente con `workflow`
- Almacenado en `localStorage`: `rr_github_config = {owner, repo, token}`
- **NUNCA commitear** al repo

### Workflow `scrape.yml` — configuración crítica

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5'   # L-V 09:00 UTC = 06:00 Chile
  workflow_dispatch:

permissions:
  contents: write            # Para git commit/push
  actions: write             # ⚠ CRÍTICO: sin esto, no dispatcha analyze.yml
```

### Desarrollo local

```bash
cd docs
python3 -m http.server 8080
# → http://localhost:8080
# No requiere build step.
```

---

## 11. Flujos operacionales

### Flujo automático diario (L-V 09:00 UTC)

```
1. scrape.yml disparado por cron
2. python scripts/scraper.py
   a. Lee regulatory_items.json existente
   b. Extrae content_hashes conocidos
   c. Por cada fuente en SCRAPERS:
      - Llama función scraper
      - Filtra por RELEVANT_RE
      - Asigna IDs (max_id + 1)
      - Registra estado
      - Sleep 2s entre fuentes
   d. Guarda regulatory_items.json actualizado
   e. Guarda sources_status.json
3. git add → git commit → git push
4. Dispatcha analyze.yml (requiere actions:write)

5. analyze.yml disparado
6. python scripts/analyzer.py
   a. Lee regulatory_items.json
   b. Lee ai_analysis.json → extrae IDs analizados
   c. Por cada item pendiente:
      - Llama Claude API (o rule_based si no hay key)
      - Combina con scoring.py
      - Sleep 1s
   d. Guarda ai_analysis.json actualizado
7. git add → git commit → git push
8. GitHub Pages actualiza automáticamente
```

### Flujo on-demand (botón frontend)

```
1. Click "🔄 Actualizar fuentes" en topbar o página Fuentes
2. Si rr_github_config no configurado → abre modal ⚙
3. POST /repos/OWNER/REPO/actions/workflows/scrape.yml/dispatches
4. Banner "⏳ Scraping en curso…"
5. Poll cada 30s → /repos/OWNER/REPO/actions/workflows/scrape.yml/runs
6. Al completar → "✅ Completado" + toast
7. Usuario recarga datos con "↻ Recargar"
```

### Flujo manual de nueva normativa

```
1. Inbox → "+ Nueva Normativa"  ó  Detail → "Editar"
2. Modal 5 tabs: Identificación, Fechas y Estado, Contenido, Impacto y Riesgo, Gestión
3. Al guardar:
   - Nueva: push a rr_manual_items_v1 con id >= 10000 + _manual: true
   - Edición: merge a rr_item_overrides_v1[item_id]
4. App.reload() → Data.enriched() recalcula con los nuevos datos
```

### Manejo de errores

- Scraper falla → status `"error"` en sources_status.json, continúa con siguiente fuente
- Claude API falla → `rule_based()` como fallback
- GitHub trigger 401 → toast "Token inválido. Reconfigura el acceso."
- Push rechazado → `git pull --rebase origin main && git push`

---

## 12. Automatizaciones

| Workflow | Trigger | Script | Output |
|---------|---------|--------|--------|
| `scrape.yml` | Cron `0 9 * * 1-5` + `workflow_dispatch` | `scraper.py` | `regulatory_items.json`, `sources_status.json` |
| `analyze.yml` | `workflow_run` (after scrape) + `workflow_dispatch` | `analyzer.py` | `ai_analysis.json` |

`GitHub.init()` al cargar la app verifica estado del último workflow run. Si está running → poll cada 30s (máx 20 intentos = 10 min).

---

## 13. Dependencias críticas

| Componente | Depende de | Riesgo si se modifica |
|-----------|-----------|----------------------|
| `Data.items()` | localStorage keys exactos | Rompe CRUD manual si se cambian keys |
| `sources_status.json` keys | Array SCRAPERS en scraper.py | Mismatch silencioso |
| `content_hash` en scraper | SHA-256 del título normalizado | Duplicados si se cambia normalización |
| `id >= 10000` para manuales | `NormativaEditor._nextId()` | Colisión IDs si normograma crece a 10000+ |
| `actions: write` en scrape.yml | Dispatch de analyze.yml | analyze.yml no se dispara nunca |
| Orden scripts index.html | Dependencias entre módulos | JS errors en runtime |
| `rr_tracking_v1` format | Tracking.get/set | Rompe seguimiento |

---

## 14. Decisiones históricas

1. **GitHub Pages en lugar de Streamlit/backend** — Para eliminar dependencia de servidor y costo de operaciones. Hosting gratuito.

2. **sources_status.json keyed por nombre del scraper (no por ID numérico)** — Intentado inicialmente con IDs, pero el scraper escribe por nombre string. Se rediseñó con mapping `SOURCE_SCRAPER_KEY` en sources.js.

3. **localStorage para tracking** — Para MVP single-user es suficiente. Multi-usuario requeriría backend o GitHub API.

4. **Fallback rule-based en analyzer.py** — Si no hay API key, el sistema sigue funcionando con clasificación por regex.

5. **IDs manuales >= 10000** — Umbral para separar de items GitHub. Si el normograma llega a 10000+, migrar a UUID.

6. **scope `repo` para PAT** — `workflow` scope no era suficiente para workflow_dispatch desde usuario externo. Confirmado en producción.

7. **`actions: write` en scrape.yml** — GITHUB_TOKEN por defecto no podía disparar otros workflows. Agregado al obtener error "Resource not accessible by integration".

8. **28 campos T3** — Provienen del Excel T3 del equipo de Compliance. Respetados fielmente para compatibilidad con procesos existentes.

9. **Distinción de entidades** — Global Card S.A. (emisor CMF) y Global 81 SpA (operadora) tienen reguladores y obligaciones distintas.

10. **Override mechanism** — `rr_item_overrides_v1` en lugar de modificar el JSON base, para que edits locales no creen conflictos de git.

---

## 15. Estado actual

### Funciona correctamente ✅

- Dashboard con 4 charts y 6 KPIs
- Bandeja de normativas con filtros
- Detalle + matriz 5D + 4 tabs + tracking form
- 20 Categorías normativas
- Fuentes con estado de scraping live
- Registro de cambios CRUD
- Alertas regulatorias CRUD
- Reporte mensual + export Excel
- Export normograma 28-col + bitácora
- Scraping automático L-V 09:00 UTC (9 fuentes)
- Análisis IA con fallback reglas
- Trigger on-demand desde frontend
- CRUD manual normativas (add/edit)
- localStorage persistence completo
- Documentación técnica completa (project-info/)

### Pendiente / Mejoras futuras ⚠️

- Scrapers BCN y ANCI fallan localmente (funcionan en GitHub Actions)
- CMF y BCCh son JS-rendered — solo endpoints alternativos/estáticos
- Manual items no sincronizan a GitHub (solo localStorage)
- Multi-usuario requeriría backend o GitHub API

---

## 16. Roadmap

### Completado (MVP v1.0) ✅
- 9 módulos frontend | Scraping 9 fuentes | CRUD manual | Trigger on-demand | Documentación completa

### Mediano plazo
- [ ] Scrapers JS-rendered con RSS feeds o APIs oficiales (CMF, BCCh)
- [ ] Sincronización manual items a GitHub via Contents API
- [ ] Notificaciones Slack/email para normativas ALTO riesgo
- [ ] Módulo Colombia (SFC, UIAF)

### Largo plazo
- [ ] Backend ligero multi-usuario (Supabase o similar)
- [ ] Dashboard ejecutivo simplificado para C-level
- [ ] Integración con tickets internos (Jira/Linear)

---

## 17. Checklist de migración

```
[ ] 1. Crear nuevo repositorio en GitHub (nombre: regulatory-radar)
[ ] 2. Copiar todos los archivos del proyecto al nuevo repo
[ ] 3. Habilitar GitHub Pages: Settings → Pages → Branch: main → Folder: /docs
[ ] 4. Agregar GitHub Secret: ANTHROPIC_API_KEY = sk-ant-XXXXX
[ ] 5. Verificar scrape.yml: permissions: { contents: write, actions: write }
[ ] 6. Verificar analyze.yml: env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
[ ] 7. Ejecutar manualmente: Actions → 🕷️ Daily Regulatory Scraping → Run workflow
[ ] 8. Esperar ~5 min a que termine scraping + análisis
[ ] 9. Verificar que la URL de GitHub Pages carga con datos
[ ] 10. En la app: ⚙ → ingresar GitHub owner, repo, y PAT con scope 'repo'
[ ] 11. Verificar botón "🔄 Actualizar fuentes" funciona
[ ] 12. Si se migran datos: copiar docs/data/*.json del repo original
[ ] 13. Verificar que localStorage no tiene datos del repo anterior
[ ] 14. Debug local: cd docs && python3 -m http.server 8080
[ ] 15. Cargar CLAUDE.md en Claude Code (se carga automáticamente al abrir la carpeta)
```

---

## 18. Prompt Maestro

> Copia el bloque completo a continuación y pégalo al inicio de una nueva sesión de Claude Code.

```
Eres el asistente de desarrollo de Radar Regulatorio, plataforma de monitoreo regulatorio automatizado para Global Card S.A. y Global 81 SpA (grupo Global66, fintech chilena).

REPOSITORIO: https://github.com/BMackenna-G66/regulatory-radar
DEPLOY:      GitHub Pages — branch main, carpeta /docs
ESTADO:      Producción, MVP v1.0 completamente funcional
STACK:       Vanilla JS (IIFEs) + Python 3.11 (GitHub Actions) + Anthropic claude-sonnet-4-6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARQUITECTURA — 5 PRINCIPIOS FUNDAMENTALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. No hay backend. Todo es estático (GitHub Pages).
2. docs/data/*.json son los datos principales — commitados automáticamente por GitHub Actions.
3. El browser hace fetch() de esos JSON al cargar la SPA.
4. Tracking y ediciones manuales van ÚNICAMENTE a localStorage del browser.
5. Data.enriched() hace el merge: items GitHub + tracking + manual_overrides de localStorage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MÓDULOS JS — IIFEs en docs/js/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.js               → router hash-based, navigate(page), toast(msg,type), App.reload()
data.js              → Data.load(), Data.items() [con merge localStorage], Data.enriched(filters), Data.stats()
github.js            → trigger GitHub Actions workflow_dispatch, localStorage config PAT
normativa-editor.js  → CRUD modal 5 tabs (28 columnas del normograma T3)
dashboard.js         → KPIs + 4 charts Chart.js
inbox.js             → tabla normativas con filtros
detail.js            → detalle + matriz impacto 5D + 4 tabs + formulario tracking
categories.js        → grid 20 categorías normativas
sources.js           → tabla fuentes + estado scraping live
changes.js           → registro cambios CRUD localStorage
alerts.js            → alertas regulatorias CRUD localStorage
report.js            → reporte mensual semáforo + export Excel
export.js            → export normograma 28-col + bitácora SheetJS
tracking.js          → seguimiento implementación localStorage

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ REGLAS QUE NUNCA SE MODIFICAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• IDs manuales DEBEN ser >= 10000 (separar de items GitHub)
• localStorage keys rr_*_v1 — cambiarlos BORRA datos de usuarios en producción
• sources_status.json keys = strings exactos del array SCRAPERS en scraper.py
  Ej: "CMF", "UAF", "Banco Central de Chile", "Diario Oficial", "SERNAC",
      "Congreso Nacional", "OFAC / GAFI", "GAFI / GAFILAT", "Agencia de Datos"
• actions: write en scrape.yml permissions ES OBLIGATORIO para dispatchar analyze.yml
• Data.items() SIEMPRE debe incluir merge de localStorage — NO usar _items directamente
• Orden scripts index.html: github.js → data.js → [módulos] → normativa-editor.js → app.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODELO DE DATOS — regulatory_items.json (28 campos T3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
id                    → int autoincremental (manual: max(10000)+1)
entity_applicable     → "Global Card S.A." | "Global 81 SpA" | "Ambas"
document_type, title (REQUERIDO), identifier, publication_date, effective_date
regulator (REQUERIDO), norm_state, regulated_subject, executive_summary
main_obligations, responsible_area
impact_legal/operational/technological/aml_cft/customer → "ALTO" | "MEDIO" | "BAJO" | null
risk_consolidated     → "ALTO" | "MEDIO" | "BAJO" (campo T3 PRINCIPAL, NO el del scorer)
required_actions, implementation_deadline
implementation_status → "Implementado" | "En Proceso" | "Pendiente" | "N/A"
expected_evidence, source_url, observations, last_review_date, responsible_update
content_hash (SHA-256 scraper), detected_at, _manual (solo items manuales)

localStorage keys:
  rr_manual_items_v1    → array normativas manuales (id >= 10000)
  rr_item_overrides_v1  → {[item_id]: {campos modificados}}
  rr_tracking_v1        → {[item_id]: {owner, due_date, progress_status, ...}}
  rr_changes_v1         → array cambios normativos
  rr_alerts_v1          → array alertas
  rr_github_config      → {owner, repo, token} para GitHub Actions API

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREDENCIALES NECESARIAS (nunca en el repo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTHROPIC_API_KEY → GitHub Secret para analyze.yml
GitHub PAT        → scope "repo" (NO solo "workflow"), usuario lo guarda via modal ⚙

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERRORES HISTÓRICOS — NO REPETIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Push rechazado: SIEMPRE git pull --rebase origin main && git push
• PAT requiere scope "repo", NO solo "workflow" — confirmado en producción
• CMF y BCCh son JS-rendered: NO scrapear homepage dinámica, usar endpoints alternativos
• Nombre del sheet Excel: "T3 – Normograma Chile" usa en dash (–) no hyphen (-)
• GITHUB_TOKEN no tiene "actions: write" por defecto → agregar explícitamente en scrape.yml

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING DE RIESGO (scoring.py — determinístico)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+30 sanciones/multas    +25 AML/LA-FT/lavado    +20 KYC/debida diligencia
+20 plazos obligatorios +15 reportes ROS/ROF    +15 pagos/transferencias
+10 proyecto de ley     +10 CMF/UAF/regulador   -20 meramente informativo
81-100 = crítico/ALTO | 61-80 = alto/ALTO | 31-60 = medio/MEDIO | 0-30 = bajo/BAJO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARA AGREGAR NUEVA VISTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. <div class="page" id="page-NOMBRE"> en index.html
2. <a class="nav-link" data-page="NOMBRE"> en sidebar
3. docs/js/NOMBRE.js con IIFE que exporta { render }
4. <script src="./js/NOMBRE.js"> en index.html (antes de app.js)
5. Registrar en App.PAGES en app.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENTACIÓN ADICIONAL (en el repo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/CLAUDE.md                → cargado automáticamente por Claude Code
/project-info/SETUP.md    → guía setup nuevo PC sin credenciales
/project-info/SCHEMA.md   → schemas completos de los 6 JSON
/project-info/MODULES.md  → documentación módulos JS y Python
/project-info/MIGRATION.md → este documento completo

Cuando necesites el código de un archivo específico, pídelo y lo comparto.
```

---

## 19. Conocimiento acumulado

### Decisiones tomadas y confirmadas en chat

| Decisión | Estado |
|---------|--------|
| `sources_status.json` usa nombres de scraper como keys (no IDs) | ✅ Implementado |
| PAT necesita scope `repo`, NO solo `workflow` | ✅ Confirmado en producción |
| `actions: write` en scrape.yml es obligatorio | ✅ Confirmado por error en producción |
| IDs manuales >= 10000 | ✅ Implementado en `NormativaEditor._nextId()` |
| Override mechanism para edits | ✅ Implementado en `rr_item_overrides_v1` |
| Trigger on-demand via GitHub Actions API | ✅ Funcionando con PAT scope `repo` |

### Cosas que NO deben modificarse

- Los localStorage keys `rr_*_v1` — contienen datos de usuarios en producción
- El schema de 28 campos T3 del normograma
- La función `Data.items()` — debe siempre mergear localStorage
- Los keys en `sources_status.json` — deben coincidir exactamente con `SCRAPERS` en scraper.py
- `actions: write` en `scrape.yml` permissions
- El orden de carga de scripts en index.html

### Errores históricos documentados

| Error | Causa | Solución |
|-------|-------|---------|
| `git push rejected` | Actions había commitado entre medio | `git pull --rebase origin main && git push` |
| `Must have admin rights to Repository` | PAT solo con scope `workflow` | Crear nuevo PAT con scope `repo` |
| `Resource not accessible by integration 403` | GITHUB_TOKEN sin `actions: write` | Agregar en permissions de scrape.yml |
| Sheet Excel con nombre incorrecto | Hyphen en lugar de en dash | `"T3 – Normograma Chile"` con `–` no `-` |
| sources.js era síncrono | Necesitaba fetchear sources_status.json | Hacer `render()` async + agregar `_loadStatus()` |

### Categorías temáticas definidas para clasificación IA

`AML` | `KYC` | `Fraude` | `Sanciones` | `PEP` | `Protección al consumidor` | `Datos personales` | `Criptoactivos` | `Tributario` | `Operacional` | `Otros`

### Áreas de compliance para tracking

`Compliance` | `Legal` | `Fraude` | `Operaciones` | `Producto` | `Finanzas` | `Tecnología` | `Data` | `CX`
