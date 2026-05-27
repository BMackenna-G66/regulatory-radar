# Setup — Radar Regulatorio

Guía paso a paso para desplegar el proyecto desde cero en un nuevo PC / cuenta de GitHub.

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Python | 3.11+ |
| Git | cualquiera reciente |
| Cuenta GitHub | con GitHub Pages habilitado |
| Clave Anthropic API | `sk-ant-...` (opcional — hay fallback sin ella) |

---

## 1. Clonar o hacer fork del repositorio

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/regulatory-radar.git
cd regulatory-radar
```

> Si vas a crear un fork nuevo: en GitHub → Fork → crea tu propio repositorio.

---

## 2. Habilitar GitHub Pages

En el repositorio en GitHub:

```
Settings → Pages → Source: "Deploy from a branch"
Branch: main  |  Folder: /docs
→ Save
```

La URL del sitio será:
```
https://YOUR_GITHUB_USERNAME.github.io/regulatory-radar/
```

---

## 3. Agregar el secret de Anthropic API

```
Settings → Secrets and variables → Actions → New repository secret

Name:  ANTHROPIC_API_KEY
Value: sk-ant-XXXXXXXXXXXXXXXX
```

> Sin esta clave el analyzer usa reglas determinísticas. El scraper funciona igual.

---

## 4. Ejecutar el scraping inicial (manual)

```
Actions → 🕷️ Daily Regulatory Scraping → Run workflow → Run workflow
```

Esto:
1. Corre `scripts/scraper.py` — detecta normativas nuevas en 9 fuentes
2. Hace commit de `docs/data/regulatory_items.json` + `docs/data/sources_status.json`
3. Dispara automáticamente `analyze.yml`
4. `scripts/analyzer.py` enriquece con IA y hace commit de `docs/data/ai_analysis.json`

Tiempo total: ~3–5 minutos.

---

## 5. Correr localmente (sin GitHub Actions)

```bash
# Instalar dependencias Python (solo para scripts, no para el frontend)
pip install -r scripts/requirements.txt

# Levantar frontend
cd docs
python3 -m http.server 8080
# → abrir http://localhost:8080
```

Para correr el scraper manualmente:
```bash
# Desde la raíz del proyecto
python scripts/scraper.py
```

Para correr el analyzer manualmente:
```bash
export ANTHROPIC_API_KEY=sk-ant-XXXXXXX
python scripts/analyzer.py
```

---

## 6. Programación automática

Los workflows corren automáticamente **Lunes a Viernes a las 09:00 UTC** (06:00 hora Chile).

Para cambiar el horario editar `.github/workflows/scrape.yml`:
```yaml
schedule:
  - cron: '0 9 * * 1-5'   # Formato: minuto hora día-mes mes día-semana
```

---

## 7. Configuración de fuentes (opcional)

Editar `config/sources.yaml` para ajustar fuentes, frecuencia de revisión y área responsable.

Las fuentes con scraper automático están en `scripts/scraper.py` en el array `SCRAPERS`. Para agregar una fuente nueva:

1. Crear una función `scrape_NOMBRE()` que retorne lista de ítems via `_make()`
2. Agregar la tupla `("Nombre Fuente", scrape_NOMBRE)` al array `SCRAPERS`
3. Agregar el key correspondiente en `docs/data/sources_status.json`
4. Agregar el mapeo en `docs/js/sources.js` → `SOURCE_SCRAPER_KEY`

---

## 8. Carga inicial de datos desde Excel

Si tienes el Excel de normativas (T3 – Normograma Chile):

```bash
# Editar la ruta en el script y correr:
python scripts/load_excel.py  # Si existe, o adaptar scraper.py
```

El schema esperado está documentado en `project-info/SCHEMA.md`.

Los datos actuales en `docs/data/regulatory_items.json` fueron cargados desde el Excel original del equipo de Compliance.

---

## 9. Personalizar entidades

Las dos entidades monitoreadas están hardcodeadas en el frontend:
- **Global Card S.A.** — emisor CMF-regulado
- **Global 81 SpA** — operadora de pagos/transferencias

Para adaptar a otro contexto, buscar y reemplazar en:
- `docs/index.html` — filtros de entidad
- `docs/js/inbox.js` — entity badges
- `docs/data/regulatory_items.json` — campo `entity_applicable`

---

## Estructura de archivos de datos

```
docs/data/
├── regulatory_items.json    ← Normativas (28 campos por ítem)
├── ai_analysis.json         ← Análisis IA (1 objeto por item_id)
├── sources.json             ← Catálogo de 20 fuentes regulatorias
├── categories.json          ← 20 categorías normativas con metadata
├── changes.json             ← Cambios normativos (seed inicial)
└── sources_status.json      ← Estado último scraping por fuente
```

Todos los archivos son **JSON estáticos servidos por GitHub Pages**. El frontend los carga con `fetch()`. No hay base de datos ni servidor.

---

## Variables de entorno locales

Crear `.env` en la raíz (ya está en `.gitignore`):

```bash
# .env (NO commitear)
ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXXXXXXXX
LOG_LEVEL=INFO
```

El script `scripts/analyzer.py` usa `python-dotenv` para cargarlo automáticamente.

---

## Troubleshooting común

| Problema | Solución |
|---------|---------|
| Página en blanco | Verificar que GitHub Pages apunta a `/docs` en rama `main` |
| Sin datos en dashboard | Correr manualmente el workflow de scraping |
| Error en analyzer | Verificar que el secret `ANTHROPIC_API_KEY` esté configurado |
| Scraper falla en una fuente | Revisar `docs/data/sources_status.json` → campo `error` |
| Cambios en localStorage no se ven | Limpiar `localStorage` en DevTools → Application |
| CORS error local | Usar `python3 -m http.server` en vez de abrir `index.html` directamente |
