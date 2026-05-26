# 📡 Radar Regulatorio – MVP

Plataforma interna para automatizar la captura, análisis, clasificación, priorización, seguimiento y reporte de cambios regulatorios en Chile y Colombia.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | Streamlit |
| DB | SQLite |
| Scraping | requests + BeautifulSoup |
| IA | Claude API (Anthropic) |
| Procesamiento | pandas |
| Export | openpyxl |
| Config | python-dotenv + PyYAML |

## Instalación rápida

### 1. Clonar repositorio

```bash
git clone https://github.com/BMackenna-G66/regulatory-radar.git
cd regulatory-radar
```

### 2. Crear entorno virtual

```bash
python3 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env y agregar tu ANTHROPIC_API_KEY
```

### 5. Ejecutar la app

```bash
streamlit run app.py
```

La app abrirá automáticamente en `http://localhost:8501`.

---

## Primeros pasos

1. **Cargar datos**: Ve a ⚙️ Configuración → "Cargar datos de prueba" para ver la app con datos de muestra
2. **Scraping real**: Ve a ⚙️ Configuración → Scraping → selecciona fuentes → "Ejecutar scraping"
3. **Análisis IA**: Ve a ⚙️ Configuración → Análisis IA → "Analizar con IA" (requiere API key)
4. **Revisar normas**: Ve a 📥 Bandeja de revisión
5. **Ver detalle**: Haz clic en cualquier norma → registra seguimiento
6. **Exportar**: Ve a 📤 Exportar → descarga Excel

---

## Estructura del proyecto

```
regulatory_radar/
│
├── app.py                    # Streamlit app (punto de entrada)
├── requirements.txt
├── .env.example
├── README.md
│
├── config/
│   └── sources.yaml          # Configuración de fuentes regulatorias
│
├── data/
│   └── regulatory_radar.db   # SQLite (se crea automáticamente)
│
├── src/
│   ├── database.py           # CRUD y conexión SQLite
│   ├── models.py             # Dataclasses
│   ├── scoring.py            # Scoring de impacto (determinístico)
│   ├── applicability.py      # Motor de aplicabilidad
│   ├── alerts.py             # Sistema de alertas
│   ├── exports.py            # Exportación Excel
│   ├── utils.py              # Utilidades compartidas
│   │
│   ├── scrapers/
│   │   ├── base_scraper.py   # Clase base abstracta
│   │   ├── cmf_scraper.py    # CMF Chile
│   │   ├── banco_central_scraper.py  # Banco Central Chile
│   │   ├── diario_oficial_scraper.py # Diario Oficial Chile
│   │   ├── sfc_scraper.py    # SFC Colombia
│   │   └── generic_scraper.py        # Scraper configurable genérico
│   │
│   └── ai/
│       ├── analyzer.py       # Integración Claude API
│       └── prompts.py        # Prompts para análisis
│
└── logs/
    └── radar.log             # Logs de operación
```

---

## Fuentes configuradas

| País | Fuente | Habilitada |
|------|--------|-----------|
| Chile | CMF – Normas y Circulares | ✅ |
| Chile | Banco Central de Chile | ✅ |
| Chile | Diario Oficial | ✅ |
| Chile | SII | ✅ |
| Colombia | Superintendencia Financiera (Circulares Externas) | ✅ |
| Colombia | SFC Cartas Circulares | ✅ |
| Chile | Cámara de Diputados | ⏸️ (configurable) |
| Chile | Congreso Nacional | ⏸️ (configurable) |

Para agregar nuevas fuentes: editar `config/sources.yaml`.

---

## Scoring de impacto

| Condición | Puntos |
|-----------|--------|
| Sanciones / multas / incumplimiento | +30 |
| AML / LA-FT / lavado | +25 |
| KYC / debida diligencia | +20 |
| Plazos obligatorios | +20 |
| Reportes regulatorios | +15 |
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

## Análisis sin API key

Si no tienes una `ANTHROPIC_API_KEY`, el sistema usa un **motor de reglas determinístico** como fallback que:
- Calcula el risk score automáticamente
- Detecta categoría temática por palabras clave
- Sugiere área responsable
- Genera resumen básico

---

## Roadmap futuro

- [ ] Scraping con JavaScript rendering (Playwright/Selenium)
- [ ] Integración Slack/email para alertas
- [ ] Scheduler automático (cron diario)
- [ ] Búsqueda full-text en textos de normas
- [ ] Exportación a PDF
- [ ] API REST para integración con otros sistemas
- [ ] Soporte multi-tenant / multi-empresa
- [ ] Fuentes adicionales: SEC, CNBV México, SBS Perú

---

## Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) | Recomendada |
| `DB_PATH` | Ruta a la base de datos SQLite | No (default: `data/regulatory_radar.db`) |
| `LOG_LEVEL` | Nivel de logging (INFO/DEBUG/WARNING) | No |
| `SLACK_WEBHOOK_URL` | Webhook de Slack para alertas | No |
| `CLAUDE_MODEL` | Modelo de Claude a usar | No (default: `claude-sonnet-4-6`) |
