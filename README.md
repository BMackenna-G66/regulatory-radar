# 📡 Radar Regulatorio

Plataforma interna para automatizar la captura, análisis, clasificación, priorización, seguimiento y reporte de cambios regulatorios en Chile y Colombia.

**→ [Ver plataforma en vivo](https://bmackenna-g66.github.io/regulatory-radar/)**

---

## Arquitectura

```
regulatory-radar/
│
├── docs/                        ← GitHub Pages (frontend estático)
│   ├── index.html               ← SPA: Dashboard, Bandeja, Detalle, Seguimiento, Exportar
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js               ← Router + init
│   │   ├── data.js              ← Carga JSON + merge con tracking
│   │   ├── dashboard.js         ← KPIs + charts (Chart.js)
│   │   ├── inbox.js             ← Bandeja de revisión filtrable
│   │   ├── detail.js            ← Vista detalle + formulario seguimiento
│   │   ├── tracking.js          ← Kanban / tabla + localStorage
│   │   └── export.js            ← Exportar Excel (SheetJS)
│   └── data/
│       ├── regulatory_items.json  ← ⟵ generado por GitHub Actions
│       └── ai_analysis.json       ← ⟵ generado por GitHub Actions
│
├── scripts/                     ← Python (corre en GitHub Actions)
│   ├── scraper.py               ← Scraping de fuentes regulatorias
│   ├── analyzer.py              ← Análisis con Claude API (+ fallback reglas)
│   ├── scoring.py               ← Scoring determinístico 0–100
│   └── requirements.txt
│
├── .github/workflows/
│   ├── scrape.yml               ← Scraping automático (L–V 09:00 UTC)
│   └── analyze.yml              ← Análisis IA al terminar el scraping
│
└── config/
    └── sources.yaml             ← Fuentes configurables
```

**Flujo de datos:**
```
GitHub Actions (scraper.py)
  → docs/data/regulatory_items.json   (commit automático)
  → dispara analyze.yml

GitHub Actions (analyzer.py)
  → docs/data/ai_analysis.json        (commit automático)
  → GitHub Pages sirve los JSON actualizados

Browser del usuario
  → carga los JSON via fetch()
  → tracking guardado en localStorage
```

---

## Vistas

| Vista | Descripción |
|-------|-------------|
| **📊 Dashboard** | KPIs + gráficos por país, regulador y categoría |
| **📥 Bandeja** | Tabla filtrable con score, nivel de riesgo y estado |
| **🔍 Detalle** | Análisis IA completo + formulario de seguimiento |
| **📋 Seguimiento** | Kanban por estado de avance + vista tabla |
| **📤 Exportar** | Descarga Excel (Bitácora Monitoreo Regulatorio) |

---

## Fuentes configuradas

| País | Fuente | Estado |
|------|--------|--------|
| Chile | CMF – Normas y Circulares | ✅ Activo |
| Chile | Banco Central de Chile | ✅ Activo |
| Chile | Diario Oficial | ✅ Activo |
| Chile | SII | ✅ Activo |
| Colombia | Superintendencia Financiera (Circulares Externas + Cartas) | ✅ Activo |

---

## Configuración inicial

### 1. Agregar el secret de Anthropic

En GitHub → Settings → Secrets → Actions → **New repository secret**:

```
Name:  ANTHROPIC_API_KEY
Value: sk-ant-...
```

> Sin API key el analyzer usa un motor de reglas determinístico como fallback.

### 2. Habilitar GitHub Pages

Settings → Pages → Source: **Deploy from branch** → Branch: `main` → Folder: `/docs`

### 3. Ejecutar scraping inicial

Actions → **🕷️ Daily Regulatory Scraping** → **Run workflow**

Esto disparará automáticamente el análisis IA y publicará los datos.

---

## Correr localmente

```bash
cd docs
python3 -m http.server 8080
# Abrir http://localhost:8080
```

---

## Scoring de impacto (determinístico)

| Condición | Puntos |
|-----------|--------|
| Sanciones / multas / incumplimiento | +30 |
| AML / LA-FT / lavado de activos | +25 |
| KYC / debida diligencia | +20 |
| Plazos obligatorios | +20 |
| Reportes regulatorios (ROS/RTE) | +15 |
| Operaciones / pagos / clientes | +15 |
| Proyecto de ley / consulta pública | +10 |
| Regulador financiero principal | +10 |
| Meramente informativo | −20 |

| Score | Nivel |
|-------|-------|
| 0–30 | 🟢 Bajo |
| 31–60 | 🟡 Medio |
| 61–80 | 🟠 Alto |
| 81–100 | 🔴 Crítico |

---

## Categorías temáticas

AML · KYC · Fraude · Sanciones · PEP · Protección al consumidor · Datos personales · Criptoactivos · Tributario · Operacional · Otros

---

## Seguimiento (localStorage)

El seguimiento de normas se persiste en `localStorage` del navegador. Para MVP single-user (un analista de Compliance) es suficiente. Para uso multi-usuario se requiere un backend o sincronización via GitHub API.
