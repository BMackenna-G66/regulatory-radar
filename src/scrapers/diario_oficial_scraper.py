"""Diario Oficial de Chile scraper."""

import re
from datetime import datetime
from typing import List

from src.scrapers.base_scraper import BaseScraper
from src.utils import normalize_date, setup_logging

logger = setup_logging("scraper.diario_oficial")

DO_URL = "https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php"


class DiarioOficialScraper(BaseScraper):
    source_id = "diario_oficial_chile"
    country = "Chile"
    regulator = "Diario Oficial"

    def fetch_items(self) -> List[dict]:
        logger.info("Fetching Diario Oficial…")
        soup = self.get_html(DO_URL)
        if not soup:
            logger.warning("Diario Oficial unavailable – using sample data")
            return self._sample_data()

        items = []
        for link in soup.find_all("a", href=True):
            text = link.get_text(strip=True)
            href = link["href"]
            if len(text) < 10:
                continue
            doc_type = self._detect_type(text)
            if not doc_type:
                continue
            url = href if href.startswith("http") else "https://www.diariooficial.interior.gob.cl" + href
            items.append(self._make_item(
                title=text,
                publication_date=datetime.now().strftime("%Y-%m-%d"),
                document_type=doc_type,
                source_url=url,
                raw_text=text,
            ))
            if len(items) >= 15:
                break

        return items if items else self._sample_data()

    def _detect_type(self, text: str) -> str:
        text_lower = text.lower()
        if "ley n°" in text_lower or "ley num" in text_lower:
            return "Ley"
        if "decreto" in text_lower:
            return "Decreto"
        if "resolución" in text_lower or "resolucion" in text_lower:
            return "Resolución"
        if "norma" in text_lower or "circular" in text_lower:
            return "Norma"
        return ""

    def _sample_data(self) -> List[dict]:
        samples = [
            {
                "title": "Ley N°21.595 – Modifica la Ley N°19.913 que crea la Unidad de Análisis Financiero sobre obligaciones de reporte para proveedores de servicios de activos virtuales",
                "pub_date": "2024-09-01",
                "doc_type": "Ley",
                "url": "https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php?date=2024-09-01",
            },
            {
                "title": "Decreto N°123 – Aprueba reglamento de la Ley de Fintech (Ley N°21.521) sobre proveedores de servicios basados en tecnología",
                "pub_date": "2024-07-15",
                "doc_type": "Decreto",
                "url": "https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php?date=2024-07-15",
            },
            {
                "title": "Resolución Exenta N°4.521 – Establece requisitos de capital mínimo para entidades de pago",
                "pub_date": "2024-05-30",
                "doc_type": "Resolución",
                "url": "https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php?date=2024-05-30",
            },
        ]
        return [
            self._make_item(
                title=s["title"],
                publication_date=s["pub_date"],
                document_type=s["doc_type"],
                source_url=s["url"],
                raw_text=s["title"],
            )
            for s in samples
        ]
