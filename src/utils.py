import hashlib
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional


def setup_logging(name: str = "regulatory_radar", log_level: str = None) -> logging.Logger:
    level = log_level or os.getenv("LOG_LEVEL", "INFO")
    logs_dir = Path(__file__).parent.parent / "logs"
    logs_dir.mkdir(exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        fh = logging.FileHandler(logs_dir / "radar.log", encoding="utf-8")
        fh.setFormatter(formatter)
        logger.addHandler(fh)

        ch = logging.StreamHandler()
        ch.setFormatter(formatter)
        logger.addHandler(ch)

    return logger


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def normalize_date(raw: str) -> Optional[str]:
    """Try multiple date formats and return ISO date string, or None."""
    if not raw:
        return None
    raw = raw.strip()
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%d %B %Y",
        "%d de %B de %Y",
        "%B %d, %Y",
        "%Y/%m/%d",
        "%d.%m.%Y",
    ]
    months_es = {
        "enero": "January", "febrero": "February", "marzo": "March",
        "abril": "April", "mayo": "May", "junio": "June",
        "julio": "July", "agosto": "August", "septiembre": "September",
        "octubre": "October", "noviembre": "November", "diciembre": "December",
    }
    normalized = raw.lower()
    for es, en in months_es.items():
        normalized = normalized.replace(es, en)
    normalized = normalized.strip().title()

    for fmt in formats:
        try:
            return datetime.strptime(normalized, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Try to extract a 4-digit year at minimum
    match = re.search(r"\b(20\d{2})\b", raw)
    if match:
        return match.group(1)
    return None


def truncate_text(text: str, max_chars: int = 5000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "… [texto truncado]"


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()

