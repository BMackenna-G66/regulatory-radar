"""Deterministic risk scoring – no AI dependency."""

import re
from typing import Tuple


_RULES = [
    (30, r"\b(sanci[oó]n|sanciones|multa|multas|incumplimiento|penalidad|penalidades)\b"),
    (25, r"\b(aml|la[/\-]ft|lavado\s+de\s+dinero|lavado\s+de\s+activos|financiamiento\s+del\s+terrorismo|financiamiento\s+al\s+terrorismo)\b"),
    (20, r"\b(kyc|debida\s+diligencia|identificaci[oó]n\s+de\s+clientes?|conoce\s+a\s+tu\s+cliente)\b"),
    (20, r"\b(plazo\s+obligatorio|plazo\s+m[aá]ximo|fecha\s+l[ií]mite|fecha\s+de\s+cumplimiento|dentro\s+de\s+\d+\s+d[ií]as)\b"),
    (15, r"\b(reporte\s+regulatorio|informe\s+regulatorio|reporte\s+peri[oó]dico|reporte\s+de\s+operaciones|ros\b|rof\b)\b"),
    (15, r"\b(operaci[oó]n|pagos|transferencias|remesas|clientes|usuarios)\b"),
    (10, r"\b(proyecto\s+de\s+ley|consulta\s+p[uú]blica|propuesta\s+normativa|proyecto\s+normativo)\b"),
    (10, r"\b(cmf|banco\s+central|superfinanciera|sfc|cnv|sbif|ferc)\b"),
    (-20, r"\b(meramente\s+informativo|solo\s+informativo|car[aá]cter\s+informativo|fines\s+informativos)\b"),
]

_RISK_LABELS = {
    (0, 30): "bajo",
    (31, 60): "medio",
    (61, 80): "alto",
    (81, 100): "crítico",
}


def compute_risk_score(text: str, title: str = "", regulator: str = "") -> Tuple[int, str]:
    combined = f"{title} {text} {regulator}".lower()
    score = 0
    for points, pattern in _RULES:
        if re.search(pattern, combined, re.IGNORECASE):
            score += points

    score = max(0, min(100, score))

    level = "bajo"
    for (low, high), label in _RISK_LABELS.items():
        if low <= score <= high:
            level = label
            break

    return score, level


def score_breakdown(text: str, title: str = "", regulator: str = "") -> list:
    """Return list of (points, rule_description) for matched rules."""
    combined = f"{title} {text} {regulator}".lower()
    matched = []
    labels = [
        "Sanciones / multas / incumplimiento",
        "AML / LA-FT / lavado de activos",
        "KYC / debida diligencia",
        "Plazos obligatorios",
        "Reportes regulatorios",
        "Afecta operaciones / pagos / clientes",
        "Proyecto de ley / consulta pública",
        "Regulador financiero principal",
        "Meramente informativo (descuento)",
    ]
    for (points, pattern), label in zip(_RULES, labels):
        if re.search(pattern, combined, re.IGNORECASE):
            matched.append({"points": points, "rule": label})
    return matched
