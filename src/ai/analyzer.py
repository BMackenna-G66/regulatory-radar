import json
import os
import time
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

from src.ai.prompts import ANALYSIS_SYSTEM, ANALYSIS_USER
from src.applicability import suggest_applicability
from src.scoring import compute_risk_score
from src.utils import setup_logging, truncate_text

load_dotenv()
logger = setup_logging("analyzer")

VALID_CATEGORIES = [
    "AML", "KYC", "Fraude", "Sanciones", "PEP",
    "Protección al consumidor", "Datos personales",
    "Criptoactivos", "Tributario", "Operacional", "Otros",
]


def _get_client():
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_anthropic_api_key_here":
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        logger.warning("anthropic package not installed")
        return None


def analyze_item(item: dict) -> dict:
    """Analyze a regulatory item with Claude. Falls back to rule-based if no API key."""
    text = truncate_text(item.get("raw_text", ""), 4000)
    title = item.get("title", "")
    regulator = item.get("regulator", "")
    country = item.get("country", "")
    doc_type = item.get("document_type", "")
    pub_date = item.get("publication_date", "")

    risk_score, risk_level = compute_risk_score(text, title, regulator)
    applicability = suggest_applicability(text, title, risk_score)

    client = _get_client()
    if client:
        ai_result = _call_claude(client, item, text)
    else:
        logger.warning("No API key – using rule-based fallback for item id=%s", item.get("id"))
        ai_result = _rule_based_fallback(item, text)

    return {
        "item_id": item["id"],
        "executive_summary": ai_result.get("resumen_ejecutivo", ""),
        "main_changes": ai_result.get("principales_cambios", ""),
        "possible_impact": ai_result.get("posible_impacto", ""),
        "affected_areas": ai_result.get("areas_afectadas", ""),
        "affected_products": ai_result.get("productos_procesos", ""),
        "detected_obligations": ai_result.get("obligaciones_detectadas", ""),
        "max_application_date": ai_result.get("fecha_maxima_aplicacion"),
        "thematic_classification": _normalize_category(ai_result.get("clasificacion_tematica", "Otros")),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "applies": applicability["applies"],
        "applies_reason": applicability["applies_reason"],
        "suggested_area": applicability["suggested_area"],
        "criticality": applicability["criticality"],
        "recommended_action": applicability["recommended_action"],
        "analyzed_at": datetime.now().isoformat(),
    }


def _call_claude(client, item: dict, text: str) -> dict:
    prompt = ANALYSIS_USER.format(
        country=item.get("country", ""),
        regulator=item.get("regulator", ""),
        document_type=item.get("document_type", ""),
        title=item.get("title", ""),
        publication_date=item.get("publication_date", ""),
        text=text,
    )
    try:
        model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        response = client.messages.create(
            model=model,
            max_tokens=2000,
            system=ANALYSIS_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("JSON parse error from Claude: %s", e)
        return {}
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return {}


def _rule_based_fallback(item: dict, text: str) -> dict:
    title = item.get("title", "")
    regulator = item.get("regulator", "")
    country = item.get("country", "")
    doc_type = item.get("document_type", "")

    category = _infer_category(text, title)
    summary = (
        f"Documento regulatorio emitido por {regulator} ({country}). "
        f"Tipo: {doc_type}. Título: {title}. "
        "Análisis automático sin IA: revisar manualmente para mayor detalle."
    )
    return {
        "resumen_ejecutivo": summary,
        "principales_cambios": "Revisar el texto original para identificar cambios específicos.",
        "posible_impacto": "Impacto por determinar. Se recomienda revisión manual.",
        "areas_afectadas": "Compliance, Legal",
        "productos_procesos": "Por determinar",
        "obligaciones_detectadas": "Revisar texto original",
        "fecha_maxima_aplicacion": None,
        "clasificacion_tematica": category,
    }


def _infer_category(text: str, title: str) -> str:
    combined = f"{title} {text}".lower()
    mapping = {
        "AML": ["aml", "lavado", "la/ft", "financiamiento del terrorismo"],
        "KYC": ["kyc", "debida diligencia", "identificación de clientes"],
        "Fraude": ["fraude", "estafa", "phishing"],
        "Sanciones": ["sanciones", "sanción", "multa"],
        "PEP": ["pep", "persona expuesta politicamente", "persona políticamente expuesta"],
        "Protección al consumidor": ["consumidor", "usuario", "reclamo", "queja"],
        "Datos personales": ["datos personales", "privacidad", "protección de datos"],
        "Criptoactivos": ["criptoactivo", "bitcoin", "blockchain", "activo digital"],
        "Tributario": ["tributario", "impuesto", "sii", "iva", "renta"],
    }
    for category, keywords in mapping.items():
        if any(kw in combined for kw in keywords):
            return category
    return "Otros"


def _normalize_category(raw: str) -> str:
    for valid in VALID_CATEGORIES:
        if valid.lower() in raw.lower():
            return valid
    return "Otros"


def batch_analyze(items: list, sleep_between: float = 1.0) -> list:
    results = []
    for item in items:
        try:
            result = analyze_item(item)
            results.append(result)
            if sleep_between > 0:
                time.sleep(sleep_between)
        except Exception as e:
            logger.error("Failed to analyze item id=%s: %s", item.get("id"), e)
    return results
