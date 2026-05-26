"""Rule-based applicability engine."""

import re
from typing import Dict


_AREA_KEYWORDS = {
    "Compliance": [
        r"\b(aml|kyc|ft|pep|sanci[oó]n|sanciones|lavado|monitoreo|reporte\s+de\s+operaciones|ros|rof|cumplimiento)\b"
    ],
    "Legal": [
        r"\b(ley|decreto|resoluci[oó]n|reglamento|normativa|legislaci[oó]n|contrato|obligaci[oó]n\s+legal|litigios?)\b"
    ],
    "Fraude": [
        r"\b(fraude|estafa|suplantaci[oó]n|phishing|ciberseguridad|autenticaci[oó]n|identidad\s+digital)\b"
    ],
    "Operaciones": [
        r"\b(operaciones?|pagos?|transferencias?|remesas?|liquidaci[oó]n|compensaci[oó]n|procesamiento)\b"
    ],
    "Producto": [
        r"\b(producto|servicio|criptoactivo|billetera\s+digital|cuenta\s+de\s+pago|tarjeta)\b"
    ],
    "Finanzas": [
        r"\b(capital|reserva|liquidez|provisi[oó]n|contabilidad|tributario|impuesto|sii)\b"
    ],
    "Tecnología": [
        r"\b(tecnolog[ií]a|sistema|infraestructura|api|software|ciberseguridad|nube|cloud)\b"
    ],
    "Data": [
        r"\b(datos\s+personales|privacidad|gdpr|pdpa|protecci[oó]n\s+de\s+datos|tratamiento\s+de\s+datos)\b"
    ],
    "CX": [
        r"\b(consumidor|cliente|usuario|queja|reclamo|protecci[oó]n\s+al\s+consumidor|experiencia\s+del\s+cliente)\b"
    ],
}

_INFORMATIVE_PATTERN = re.compile(
    r"\b(meramente\s+informativo|solo\s+informativo|car[aá]cter\s+informativo|fines\s+informativos)\b",
    re.IGNORECASE,
)
_HIGH_OBLIGATION_PATTERN = re.compile(
    r"\b(deber[aá]|deben|est[aá]n\s+obligados?|es\s+obligatorio|plazo\s+de\s+\d+|multa|sanci[oó]n)\b",
    re.IGNORECASE,
)


def suggest_applicability(text: str, title: str = "", risk_score: int = 0) -> Dict:
    combined = f"{title} {text}".lower()

    if _INFORMATIVE_PATTERN.search(combined):
        applies = "no"
        reason = "Documento de carácter meramente informativo, sin obligaciones directas."
        criticality = "bajo"
    elif risk_score >= 61 or _HIGH_OBLIGATION_PATTERN.search(combined):
        applies = "sí"
        reason = "Contiene obligaciones, plazos o sanciones que requieren acción."
        criticality = "alto" if risk_score < 81 else "crítico"
    elif risk_score >= 31:
        applies = "revisar"
        reason = "Posible impacto regulatorio. Requiere revisión por experto."
        criticality = "medio"
    else:
        applies = "revisar"
        reason = "Impacto no determinado. Se recomienda revisión."
        criticality = "bajo"

    # Detect best-fit area
    area_scores: Dict[str, int] = {}
    for area, patterns in _AREA_KEYWORDS.items():
        cnt = sum(len(re.findall(p, combined, re.IGNORECASE)) for p in patterns)
        if cnt > 0:
            area_scores[area] = cnt
    suggested_area = max(area_scores, key=area_scores.get) if area_scores else "Compliance"

    # Recommended action
    if applies == "sí" and criticality == "crítico":
        action = "Acción inmediata requerida. Asignar responsable y definir plan de implementación."
    elif applies == "sí":
        action = "Revisar y definir plan de implementación con responsable de área."
    elif applies == "revisar":
        action = "Evaluar aplicabilidad con área de Compliance/Legal y tomar decisión."
    else:
        action = "Archivar. Monitorear si hay actualizaciones."

    return {
        "applies": applies,
        "applies_reason": reason,
        "suggested_area": suggested_area,
        "criticality": criticality,
        "recommended_action": action,
    }
