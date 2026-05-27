# Módulos — Radar Regulatorio

Documentación de cada módulo frontend y backend.

---

## Frontend (docs/js/)

Todos los módulos JS son **IIFEs** (Immediately Invoked Function Expressions) que exponen un objeto público. Se cargan en orden en `index.html` — no hay bundler.

### Orden de carga de scripts en index.html

```html
<script src="./js/data.js">
<script src="./js/tracking.js">
<script src="./js/dashboard.js">
<script src="./js/inbox.js">
<script src="./js/detail.js">
<script src="./js/categories.js">
<script src="./js/sources.js">
<script src="./js/changes.js">
<script src="./js/alerts.js">
<script src="./js/report.js">
<script src="./js/export.js">
<script src="./js/app.js">   ← último: inicia todo con DOMContentLoaded
```

---

### `app.js` — Router y navegación

```js
App.navigate(page)          // cambia de página por hash
App.navigateDetail(itemId)  // navega al detalle de una norma
App.reload()                // recarga todos los datos y re-renderiza
App.toast(msg, type)        // muestra notificación (info/success/error)
```

Páginas registradas: `dashboard`, `inbox`, `detail`, `categories`, `sources`, `tracking`, `changes`, `alerts`, `report`, `export`

Hash routing: `window.location.hash` — ej. `#inbox`, `#dashboard`

---

### `data.js` — Capa de datos

Carga 4 JSON al iniciar:
- `regulatory_items.json`
- `ai_analysis.json`
- `sources.json`
- `categories.json`

```js
await Data.load()           // carga todos los JSON en paralelo
Data.items()                // array raw de normativas
Data.analysis()             // array raw de análisis
Data.sources()              // array de fuentes
Data.categories()           // array de categorías
Data.itemById(id)           // normativa por id
Data.analysisFor(itemId)    // análisis para un item_id
Data.enriched(filters)      // merge items+analysis+tracking, filtrado
Data.stats()                // KPIs: total, critical, byRegulator, byCategory, etc.
```

**`enriched()`** hace spread merge: `{ ...item, ...analysisObj, ...trackingObj }` — los campos de analysis sobreescriben item, tracking sobreescribe analysis.

---

### `tracking.js` — Seguimiento de implementación

Persiste en `localStorage` con key `rr_tracking_v1`.

```js
Tracking.get(itemId)        // objeto de tracking o null
Tracking.save(itemId, data) // guarda/actualiza tracking
Tracking.getAll()           // todos los trackings
Tracking.render()           // renderiza vista de seguimiento (tabla + kanban)
```

Estados de progreso: `nuevo` · `en_revision` · `implementado` · `cerrado` · `no_aplica`

---

### `dashboard.js` — Dashboard ejecutivo

KPIs calculados con `Data.stats()`:
- Total normativas, Riesgo ALTO, Implementadas, En Proceso, Nuevas/Pendientes, Por vencer (7 días)

4 gráficos Chart.js:
1. **Bar horizontal** — Normativas por regulador
2. **Doughnut** — Distribución por categoría temática
3. **Bar** — Estado de implementación
4. **Doughnut** — Por entidad (Global Card vs G81 vs Ambas)

Paleta IMPL_COLORS: Implementado `#1a7a3e` · En Proceso `#6d28d9` · Pendiente `#c87a00` · N/A `#64748b`

---

### `inbox.js` — Bandeja de normativas

Tabla filtrable. Filtros: búsqueda libre, entidad, regulador, tipo documento, riesgo, estado implementación.

Badges por entidad:
- GC (green `#dff5ec` / `#1a7a3e`) = Global Card S.A.
- G81 (amber `#fff7e6` / `#92400e`) = Global 81 SpA
- Ambas (blue `#e8f0fd` / `#1e5fbc`)

Click en fila → `App.navigateDetail(id)`

---

### `detail.js` — Vista de detalle

4 tabs:
1. **Análisis IA** — resumen ejecutivo, impacto, área, criticidad, acción recomendada
2. **Obligaciones** — main_obligations, required_actions, expected_evidence
3. **Ficha Completa** — todos los 28 campos del normograma
4. **Seguimiento** — formulario de tracking (owner, due_date, status, comments, etc.)

**Matriz de impacto 5D** — renderizada en el header del detalle:
- Legal · Operacional · Tecnológico · AML/CFT · Clientes
- Barra de progreso coloreada por nivel (ALTO=rojo, MEDIO=amarillo, BAJO=verde)

```js
Detail.render(itemId)       // renderiza la página de detalle
```

---

### `categories.js` — Categorías normativas

Grid responsivo de 20 tarjetas. Cada tarjeta muestra:
- Indicador de color por riesgo (izquierda)
- Nombre, entidad, cantidad de normas
- Descripción, prioridad de monitoreo
- Strip de alerta si hay proyectos de ley pendientes

Click en tarjeta → navega a inbox

```js
Categories.render()
```

---

### `sources.js` — Fuentes regulatorias

Tabla de 20 fuentes. Carga `sources_status.json` de forma asíncrona para mostrar:
- Ícono ⚙ si tiene scraper automático, 👤 si es manual
- Badge OK / Error / Pendiente / Manual
- Tiempo relativo desde última revisión

Mapeo `SOURCE_SCRAPER_KEY`: source ID → key en sources_status.json

```js
Sources.render()            // async, carga status antes de renderizar
```

---

### `changes.js` — Registro de cambios normativos

CRUD completo con modal. Datos en `localStorage` (`rr_changes_v1`). Se inicializa con seed de `docs/data/changes.json` en el primer uso.

Tipos de cambio: Norma Nueva · Modificación · Derogación · Proyecto de Ley · Consulta Pública · Alerta OFAC

```js
Changes.render()            // renderiza tabla
Changes.openModal(id?)      // abre modal (nuevo si no id, editar si id)
Changes.save()              // guarda desde el modal
Changes.delete(id)          // elimina un cambio
```

---

### `alerts.js` — Alertas regulatorias

3 niveles visuales:
- **urgente** → borde/header rojo (badge-critico)
- **seguimiento** → borde/header amarillo (badge-alto)
- **informativa** → borde/header azul

CRUD con modal. Datos en `localStorage` (`rr_alerts_v1`).

```js
Alerts.render()
Alerts.openModal(id?)
Alerts.save()
Alerts.delete(id)
```

---

### `report.js` — Reporte mensual para comités

Semáforo de cumplimiento por categoría normativa con columnas:
- Categoría · Riesgo · Estado general · Normas vigentes · Brechas · Acciones pendientes · Próxima fecha límite · Comentario ejecutivo

```js
Report.render()             // renderiza semáforo + KPIs del mes
Report.downloadExcel()      // descarga .xlsx con 2 hojas:
                            //   "Semáforo Cumplimiento" + "Normograma Resumen"
```

---

### `export.js` — Exportar datos

Filtros: entidad, estado implementación, riesgo consolidado.

```js
Export.downloadNormogram()  // Normograma_Chile_YYYY-MM-DD.xlsx (28 columnas)
Export.downloadBitacora()   // Bitacora_Regulatoria_YYYY-MM-DD.xlsx (formato tracking)
Export.updatePreview()      // actualiza contador de normas a exportar
```

Ambos usan SheetJS (`XLSX.utils.aoa_to_sheet`). El normograma tiene columnas con anchos definidos para presentación.

---

## Backend (scripts/)

### `scraper.py`

**Función `main()`:**
1. Carga `regulatory_items.json` existente
2. Extrae hashes conocidos para dedup
3. Itera `SCRAPERS` — para cada fuente:
   - Llama función scraper correspondiente
   - Filtra por `is_relevant()` (regex de 40+ keywords)
   - Asigna IDs nuevos a ítems sin hash conocido
   - Registra estado en `sources_status`
4. Guarda `regulatory_items.json` actualizado
5. Guarda `sources_status.json`

**`_make(title, pub_date, doc_type, url, regulator, ...)`**
Helper que construye un ítem de 28 campos con defaults:
- `status`: `"nuevo"`, `implementation_status`: `"Pendiente"`, `entity_applicable`: `"Ambas"`
- Todos los campos de impacto: `null` (AI los rellena en analyzer.py)

**`is_relevant(title, extra_text="")`**
Retorna `True` si el texto contiene algún keyword del regex `RELEVANT_RE`.

---

### `analyzer.py`

**Función `main()`:**
1. Lee todos los items de `regulatory_items.json`
2. Lee `ai_analysis.json` existente — extrae IDs ya analizados
3. Para cada item pendiente:
   - Si hay API key → llama `call_claude()` (modelo claude-sonnet-4-6)
   - Si no → `rule_based()` con clasificación por keywords
4. Combina con `compute_applicability()` y `detect_area()`
5. Guarda `ai_analysis.json` actualizado

**Prompt a Claude:**
Solicita JSON con: resumen_ejecutivo, principales_cambios, posible_impacto, areas_afectadas, productos_procesos, obligaciones_detectadas, fecha_maxima_aplicacion, clasificacion_tematica.

---

### `scoring.py`

```python
compute_risk_score(text, title="", regulator="") → (score: int, level: str)
```

Score determinístico 0–100 basado en regex patterns. Usado por `analyzer.py` como complemento al análisis IA.

---

## GitHub Actions

### `scrape.yml` — Lunes a Viernes 09:00 UTC

```
checkout → setup python → pip install → python scripts/scraper.py
→ git add regulatory_items.json sources_status.json
→ git commit + push (si hay cambios)
→ dispatch analyze.yml
```

### `analyze.yml` — Se dispara al terminar scrape.yml

```
checkout → setup python → pip install
→ ANTHROPIC_API_KEY desde secrets
→ python scripts/analyzer.py
→ git add ai_analysis.json
→ git commit + push (si hay cambios)
```

Ambos workflows tienen `permissions: contents: write` para poder hacer push.
