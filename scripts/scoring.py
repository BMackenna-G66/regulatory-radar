import re
from typing import Tuple

_RULES = [
    (30, r"\b(sanci[oó]n|sanciones|multa|multas|incumplimiento|penalidad)\b"),
    (25, r"\b(aml|la[/\-]ft|lavado\s+de\s+dinero|lavado\s+de\s+activos|financiamiento\s+del\s+terrorismo)\b"),
    (20, r"\b(kyc|debida\s+diligencia|identificaci[oó]n\s+de\s+clientes?|conoce\s+a\s+tu\s+cliente)\b"),
    (20, r"\b(plazo\s+obligatorio|plazo\s+m[aá]ximo|fecha\s+l[ií]mite|dentro\s+de\s+\d+\s+d[ií]as)\b"),
    (15, r"\b(reporte\s+regulatorio|informe\s+regulatorio|ros\b|rof\b|reporte\s+de\s+operaciones)\b"),
    (15, r"\b(operaci[oó]n|pagos?|transferencias?|remesas?|clientes|usuarios)\b"),
    (10, r"\b(proyecto\s+de\s+ley|consulta\s+p[uú]blica|propuesta\s+normativa)\b"),
    (10, r"\b(cmf|banco\s+central|superfinanciera|sfc|uaf|uiaf)\b"),
    (-20, r"\b(meramente\s+informativo|solo\s+informativo|car[aá]cter\s+informativo)\b"),
]

_LEVELS = [(81, 100, "crítico"), (61, 80, "alto"), (31, 60, "medio"), (0, 30, "bajo")]


def compute_risk_score(text: str, title: str = "", regulator: str = "") -> Tuple[int, str]:
    combined = f"{title} {text} {regulator}".lower()
    score = sum(pts for pts, pat in _RULES if re.search(pat, combined, re.IGNORECASE))
    score = max(0, min(100, score))
    level = next((lbl for lo, hi, lbl in _LEVELS if lo <= score <= hi), "bajo")
    return score, level
