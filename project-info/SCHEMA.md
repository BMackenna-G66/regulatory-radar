# Schemas de datos — Radar Regulatorio

---

## regulatory_items.json

Array de objetos. Cada objeto es una normativa del normograma (T3). **28 campos.**

```jsonc
{
  // Identificación
  "id": 1,                              // int, autoincremental
  "country": "Chile",                   // string
  "entity_applicable": "Ambas",         // "Global Card S.A." | "Global 81 SpA" | "Ambas"
  "document_type": "Circular",          // tipo de documento
  "title": "Circular N°...",            // nombre completo de la norma
  "identifier": "NCG 454",             // código/número oficial
  "publication_date": "2024-01-15",    // ISO date string
  "effective_date": "2024-03-01",      // ISO date string (puede ser null)
  "regulator": "CMF",                  // entidad reguladora
  "norm_state": "Vigente",             // "Vigente" | "Derogada" | "En consulta"

  // Contenido regulatorio
  "regulated_subject": "Emisores de tarjetas prepago",
  "executive_summary": "...",          // resumen ejecutivo
  "main_obligations": "...",           // obligaciones principales
  "responsible_area": "Compliance",    // área interna responsable

  // Matriz de impacto 5D (cada uno: "ALTO" | "MEDIO" | "BAJO" | null)
  "impact_legal": "ALTO",
  "impact_operational": "MEDIO",
  "impact_technological": "BAJO",
  "impact_aml_cft": "ALTO",
  "impact_customer": "MEDIO",

  // Riesgo y cumplimiento
  "risk_consolidated": "ALTO",         // "ALTO" | "MEDIO" | "BAJO"
  "required_actions": "...",           // acciones requeridas
  "implementation_deadline": "2025-06-30",
  "implementation_status": "En Proceso", // "Implementado" | "En Proceso" | "Pendiente" | "N/A"
  "expected_evidence": "...",          // evidencia de cumplimiento esperada

  // Metadata
  "source_url": "https://...",
  "observations": "...",
  "last_review_date": "2025-05-01",
  "responsible_update": "Equipo Compliance",

  // Campos legacy / compat
  "status": "aplica_requiere_accion",  // derivado de implementation_status
  "content_hash": "abc123...",         // SHA-256 para dedup en scraper
  "detected_at": "2025-05-27T09:00:00" // cuándo fue detectado por el scraper
}
```

### Mapeo `implementation_status` → `status` (legacy)

| implementation_status | status |
|----------------------|--------|
| Implementado | `implementado` |
| En Proceso | `aplica_requiere_accion` |
| Pendiente | `aplica_requiere_accion` |
| N/A | `no_aplica` |

---

## ai_analysis.json

Array de objetos. Uno por normativa analizada. Producido por `scripts/analyzer.py`.

```jsonc
{
  "item_id": 1,                         // referencia a regulatory_items.json
  "executive_summary": "...",
  "main_changes": "...",
  "possible_impact": "...",
  "affected_areas": "Compliance, Legal",
  "affected_products": "...",
  "detected_obligations": "...",
  "max_application_date": "2025-06-30", // null si no se menciona
  "thematic_classification": "AML",    // ver categorías abajo
  "risk_score": 75,                    // 0–100
  "risk_level": "alto",               // "crítico" | "alto" | "medio" | "bajo"
  "applies": "sí",                    // "sí" | "no" | "revisar"
  "applies_reason": "...",
  "suggested_area": "Compliance",
  "criticality": "alto",
  "recommended_action": "...",
  "analyzed_at": "2025-05-27T09:00:00"
}
```

### Categorías temáticas (`thematic_classification`)

`AML` · `KYC` · `Fraude` · `Sanciones` · `PEP` · `Protección al consumidor` · `Datos personales` · `Criptoactivos` · `Tributario` · `Operacional` · `Otros`

### Scoring de riesgo (determinístico — `scripts/scoring.py`)

| Condición en título/texto | Puntos |
|--------------------------|--------|
| Sanciones / multas / incumplimiento | +30 |
| AML / LA-FT / lavado de activos | +25 |
| KYC / debida diligencia | +20 |
| Plazos obligatorios / fecha límite | +20 |
| Reportes regulatorios (ROS, etc.) | +15 |
| Operaciones / pagos / clientes | +15 |
| Proyecto de ley / consulta pública | +10 |
| Regulador financiero (CMF, UAF, etc.) | +10 |
| Meramente informativo | −20 |

| Score | risk_level | risk_consolidated |
|-------|-----------|-------------------|
| 81–100 | `crítico` | `ALTO` |
| 61–80 | `alto` | `ALTO` |
| 31–60 | `medio` | `MEDIO` |
| 0–30 | `bajo` | `BAJO` |

---

## sources.json

Array de objetos. 20 fuentes regulatorias del catálogo T2.

```jsonc
{
  "id": 1,
  "name": "CMF – Comisión para el Mercado Financiero",
  "institution": "CMF",
  "info_type": "Normativa primaria",
  "url": "cmf.cl/legislacion-y-normativa/",
  "review_frequency": "Semanal",    // "Diaria" | "Semanal" | "Quincenal" | "Mensual"
  "responsible_area": "Compliance",
  "criticality": "ALTA",            // "ALTA" | "MEDIA" | "BAJA"
  "comments": "..."
}
```

---

## sources_status.json

Objeto keyed por nombre de scraper (coincide con `SCRAPERS` en `scraper.py`).

```jsonc
{
  "CMF": {
    "last_checked": "2025-05-27T09:00:00", // ISO datetime | null
    "status": "ok",                         // "ok" | "error" | "pending"
    "new_items_found": 2,
    "total_scraped": 15,
    "error": null                           // string con mensaje de error | null
  },
  "UAF": { ... },
  "Banco Central de Chile": { ... },
  "Diario Oficial": { ... },
  "SERNAC": { ... },
  "Congreso Nacional": { ... },
  "OFAC / GAFI": { ... },
  "GAFI / GAFILAT": { ... },
  "Agencia de Datos": { ... }
}
```

**Mapeo source ID → scraper key** (en `docs/js/sources.js`):

| Source ID | Scraper key |
|-----------|-------------|
| 1 | CMF |
| 2 | UAF |
| 3 | Banco Central de Chile |
| 4 | Diario Oficial |
| 5, 6, 7 | Congreso Nacional |
| 8 | SERNAC |
| 9 | Agencia de Datos |
| 11 | CMF |
| 17, 18 | GAFI / GAFILAT |
| 19 | OFAC / GAFI |

---

## categories.json

Array de objetos. 20 categorías normativas (T7).

```jsonc
{
  "id": 1,
  "name": "AML/CFT",
  "description": "...",
  "entity_applicable": "Ambas",
  "regulator": "UAF, CMF",
  "main_norms": "Ley 19.913, Circular UAF...",
  "pending_bills": "...",           // proyectos de ley relevantes
  "risk_level": "ALTO",
  "responsible_area": "Compliance",
  "monitoring_priority": "INMEDIATA", // "INMEDIATA" | "CORTO PLAZO" | "MEDIANO PLAZO" | "LARGO PLAZO"
  "norm_count": 12,
  "observations": "..."
}
```

---

## changes.json

Array de objetos. Registro de cambios normativos (T10). Seed inicial; se persiste en `localStorage` (`rr_changes_v1`).

```jsonc
{
  "id": 1,
  "detection_date": "2025-05-01",
  "source": "CMF",
  "norm_name": "...",
  "change_type": "Norma Nueva",    // "Norma Nueva" | "Modificación" | "Derogación" |
                                    // "Proyecto de Ley" | "Consulta Pública" | "Alerta OFAC"
  "entity": "Ambas",
  "impact_level": "ALTO",
  "description": "...",
  "required_action": "...",
  "responsible": "Compliance",
  "deadline": "2025-06-30",
  "status": "En Proceso",          // "En Proceso" | "Implementado" | "Pendiente"
  "evidence": "",
  "observations": "",
  "created_at": "2025-05-01T00:00:00"
}
```

---

## localStorage keys

| Key | Módulo | Contenido |
|-----|--------|-----------|
| `rr_tracking_v1` | Tracking | `{ [item_id]: { progress_status, owner, due_date, comments, action_plan, evidence_url, applies, responsible_area } }` |
| `rr_changes_v1` | Changes | Array de cambios (igual a changes.json) |
| `rr_alerts_v1` | Alerts | Array de alertas regulatorias |

---

## Estructura de un ítem de tracking (localStorage)

```jsonc
{
  "progress_status": "en_revision",  // "nuevo" | "en_revision" | "implementado" | "cerrado" | "no_aplica"
  "owner": "Ana García",
  "due_date": "2025-06-30",
  "comments": "...",
  "action_plan": "...",
  "evidence_url": "https://...",
  "applies": "Si",
  "responsible_area": "Compliance"
}
```

---

## Estructura de una alerta (localStorage)

```jsonc
{
  "id": "alert-1234567890",
  "level": "urgente",               // "urgente" | "seguimiento" | "informativa"
  "source": "CMF",
  "entity": "Ambas",
  "title": "...",
  "description": "...",
  "obligations": "• Obligación 1\n• Obligación 2",
  "pub_date": "2025-05-20",
  "deadline": "2025-06-30",
  "status": "Activa",              // "Activa" | "En Gestión" | "Cerrada"
  "created_at": "2025-05-27T09:00:00"
}
```
