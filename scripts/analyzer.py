#!/usr/bin/env python3
"""
AI analyzer – runs in GitHub Actions and writes to docs/data/ai_analysis.json
Reads regulatory_items.json, analyzes unanalyzed items with Claude, writes results.
"""

import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("analyzer")

ROOT = Path(__file__).parent.parent
ITEMS_FILE  = ROOT / "docs" / "data" / "regulatory_items.json"
ANALYSIS_FILE = ROOT / "docs" / "data" / "ai_analysis.json"

CATEGORIES = ["AML","KYC","Fraude","Sanciones","PEP","Protección al consumidor",
               "Datos personales","Criptoactivos","Tributario","Operacional","Otros"]

SYSTEM_PROMPT = """Eres un experto en compliance regulatorio financiero para Latinoamérica.
Analiza documentos regulatorios y extrae información estructurada. Responde siempre en español."""

USER_PROMPT = """Analiza este documento regulatorio y responde en JSON con estas claves exactas:
{{
  "resumen_ejecutivo": "3-5 oraciones.",
  "principales_cambios": "Lista de cambios relevantes.",
  "posible_impacto": "Impacto para empresa fintech/pagos.",
  "areas_afectadas": "Áreas: Compliance, Legal, Fraude, Operaciones, Producto, Finanzas, Tecnología, Data, CX.",
  "productos_procesos": "Productos o procesos afectados.",
  "obligaciones_detectadas": "Obligaciones concretas.",
  "fecha_maxima_aplicacion": "Fecha ISO si se menciona, sino null.",
  "clasificacion_tematica": "UNA de: AML, KYC, Fraude, Sanciones, PEP, Protección al consumidor, Datos personales, Criptoactivos, Tributario, Operacional, Otros"
}}

País: {country} | Regulador: {regulator} | Tipo: {document_type}
Título: {title}
Fecha: {publication_date}

Responde SOLO el JSON."""


def load_json(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def save_json(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_client():
    api_key = os.getenv("ANTHROPIC_API_KEY","")
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        log.warning("anthropic not installed")
        return None


def call_claude(client, item: dict) -> dict:
    prompt = USER_PROMPT.format(
        country=item.get("country",""),
        regulator=item.get("regulator",""),
        document_type=item.get("document_type",""),
        title=item.get("title","")[:500],
        publication_date=item.get("publication_date",""),
    )
    resp = client.messages.create(
        model=os.getenv("CLAUDE_MODEL","claude-sonnet-4-6"),
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role":"user","content":prompt}],
    )
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def rule_based(item: dict) -> dict:
    from scoring import compute_risk_score
    title = item.get("title","")
    text = title
    combined = text.lower()
    cat = "Otros"
    for c, kws in [
        ("AML",["aml","lavado","la/ft","financiamiento del terrorismo","uaf","uiaf","sarlaft"]),
        ("KYC",["kyc","debida diligencia","identificación de clientes"]),
        ("Fraude",["fraude","estafa","phishing"]),
        ("Sanciones",["sanciones","sanción","multa"]),
        ("PEP",["pep","persona expuesta","políticamente expuesta"]),
        ("Protección al consumidor",["consumidor","usuario","reclamo","queja"]),
        ("Datos personales",["datos personales","privacidad","protección de datos"]),
        ("Criptoactivos",["criptoactivo","bitcoin","blockchain","activo digital","activo virtual","psav"]),
        ("Tributario",["tributario","impuesto","sii","iva","renta"]),
        ("Operacional",["operaciones","pagos","transferencias","remesas","límite","sistema"]),
    ]:
        if any(k in combined for k in kws):
            cat = c
            break
    return {
        "resumen_ejecutivo": f"Documento {item.get('document_type','')} emitido por {item.get('regulator','')}. Título: {title}. Revisión manual recomendada.",
        "principales_cambios": "Ver texto original.",
        "posible_impacto": "Por determinar mediante revisión manual.",
        "areas_afectadas": "Compliance, Legal",
        "productos_procesos": "Por determinar",
        "obligaciones_detectadas": "Ver texto original.",
        "fecha_maxima_aplicacion": None,
        "clasificacion_tematica": cat,
    }


def compute_applicability(text: str, title: str, risk_score: int) -> dict:
    combined = f"{title} {text}".lower()
    informative = bool(re.search(r"\b(meramente\s+informativo|solo\s+informativo|car[aá]cter\s+informativo)\b", combined))
    obligatory = bool(re.search(r"\b(deber[aá]|deben|obligatorio|multa|sanción|plazo\s+de\s+\d+)\b", combined))

    if informative:
        return {"applies":"no","reason":"Documento de carácter informativo.","criticality":"bajo"}
    if risk_score >= 61 or obligatory:
        crit = "crítico" if risk_score >= 81 else "alto"
        return {"applies":"sí","reason":"Contiene obligaciones o sanciones.","criticality":crit}
    if risk_score >= 31:
        return {"applies":"revisar","reason":"Posible impacto. Requiere revisión.","criticality":"medio"}
    return {"applies":"revisar","reason":"Impacto no determinado.","criticality":"bajo"}


def detect_area(text: str, title: str) -> str:
    combined = f"{title} {text}".lower()
    areas = {
        "Compliance": ["aml","kyc","ft","pep","sanción","sanciones","lavado","cumplimiento","uaf","uiaf"],
        "Legal":      ["ley","decreto","resolución","reglamento","normativa","legislación"],
        "Fraude":     ["fraude","estafa","suplantación","phishing","ciberseguridad"],
        "Operaciones":["operaciones","pagos","transferencias","remesas","liquidación"],
        "Producto":   ["producto","servicio","criptoactivo","billetera","cuenta de pago"],
        "Finanzas":   ["capital","reserva","liquidez","tributario","impuesto","sii"],
        "Tecnología": ["tecnología","sistema","infraestructura","api","software","cloud"],
        "Data":       ["datos personales","privacidad","gdpr","protección de datos"],
        "CX":         ["consumidor","cliente","usuario","queja","reclamo"],
    }
    scores = {a: sum(1 for k in kws if k in combined) for a, kws in areas.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Compliance"


def analyze_item(item: dict, client) -> dict:
    from scoring import compute_risk_score
    risk_score, risk_level = compute_risk_score(item.get("title",""), item.get("title",""), item.get("regulator",""))

    if client:
        try:
            ai = call_claude(client, item)
        except Exception as e:
            log.warning("Claude failed for item %s: %s", item.get("id"), e)
            ai = rule_based(item)
    else:
        ai = rule_based(item)

    cat = ai.get("clasificacion_tematica","Otros")
    if cat not in CATEGORIES:
        cat = next((c for c in CATEGORIES if c.lower() in cat.lower()), "Otros")

    applicability = compute_applicability(
        ai.get("posible_impacto",""), item.get("title",""), risk_score
    )
    area = detect_area(ai.get("areas_afectadas","") + ai.get("posible_impacto",""), item.get("title",""))

    action_map = {
        "crítico": "Acción inmediata. Asignar responsable en 48h.",
        "alto":    "Definir plan de implementación con área responsable.",
        "medio":   "Evaluar aplicabilidad con Compliance/Legal.",
        "bajo":    "Archivar. Monitorear actualizaciones.",
    }

    return {
        "item_id":                item["id"],
        "executive_summary":      ai.get("resumen_ejecutivo",""),
        "main_changes":           ai.get("principales_cambios",""),
        "possible_impact":        ai.get("posible_impacto",""),
        "affected_areas":         ai.get("areas_afectadas",""),
        "affected_products":      ai.get("productos_procesos",""),
        "detected_obligations":   ai.get("obligaciones_detectadas",""),
        "max_application_date":   ai.get("fecha_maxima_aplicacion"),
        "thematic_classification":cat,
        "risk_score":             risk_score,
        "risk_level":             risk_level,
        "applies":                applicability["applies"],
        "applies_reason":         applicability["reason"],
        "suggested_area":         area,
        "criticality":            applicability["criticality"],
        "recommended_action":     action_map.get(applicability["criticality"],"Revisar."),
        "analyzed_at":            datetime.now().isoformat(timespec="seconds"),
    }


def main():
    items = load_json(ITEMS_FILE)
    existing_analysis = load_json(ANALYSIS_FILE)
    analyzed_ids = {a["item_id"] for a in existing_analysis}
    pending = [i for i in items if i.get("id") and i["id"] not in analyzed_ids]

    log.info("%d items pending analysis", len(pending))
    if not pending:
        log.info("Nothing to analyze.")
        return

    client = get_client()
    if not client:
        log.warning("No ANTHROPIC_API_KEY – using rule-based fallback")

    results = list(existing_analysis)
    for item in pending:
        log.info("Analyzing item %s: %s", item["id"], item["title"][:60])
        try:
            result = analyze_item(item, client)
            results.append(result)
        except Exception as e:
            log.error("Failed item %s: %s", item.get("id"), e)
        time.sleep(1)

    save_json(ANALYSIS_FILE, results)
    log.info("Analysis complete. %d total records.", len(results))


if __name__ == "__main__":
    main()
