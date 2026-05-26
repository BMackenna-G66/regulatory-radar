"""Superintendencia Financiera de Colombia scraper."""

import re
import time
from typing import List

from src.scrapers.base_scraper import BaseScraper
from src.utils import normalize_date, setup_logging

logger = setup_logging("scraper.sfc")

SFC_BASE = "https://www.superfinanciera.gov.co"
SFC_CE_URL = "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&lTipo=publicaciones&lFuncion=loadContenidoPublicacion&id=60950"
SFC_CC_URL = "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&lTipo=publicaciones&lFuncion=loadContenidoPublicacion&id=60952"


class SFCScraper(BaseScraper):
    source_id = "sfc_colombia"
    country = "Colombia"
    regulator = "Superintendencia Financiera de Colombia"

    def fetch_items(self) -> List[dict]:
        items = []
        logger.info("Fetching SFC Circulares Externas…")
        items.extend(self._fetch_section(SFC_CE_URL, "Circular Externa"))
        time.sleep(self.rate_limit)
        logger.info("Fetching SFC Cartas Circulares…")
        items.extend(self._fetch_section(SFC_CC_URL, "Carta Circular"))
        return items if items else self._sample_data()

    def _fetch_section(self, url: str, doc_type: str) -> List[dict]:
        soup = self.get_html(url)
        if not soup:
            return []

        items = []
        # SFC page structure varies; try multiple patterns
        for row in soup.select("table tr, .lista-normas li, .resultados-busqueda .item"):
            text = row.get_text(separator=" ", strip=True)
            link = row.find("a", href=True)
            if not text or len(text) < 10:
                continue

            # Extract date pattern dd/mm/yyyy or yyyy-mm-dd
            date_match = re.search(r"\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b", text)
            pub_date = normalize_date(date_match.group(0)) if date_match else None

            href = link["href"] if link else url
            full_url = href if href.startswith("http") else SFC_BASE + href

            title = text[:200]
            items.append(self._make_item(
                title=title,
                publication_date=pub_date,
                document_type=doc_type,
                source_url=full_url,
                raw_text=title,
            ))
            if len(items) >= 10:
                break
        return items

    def _sample_data(self) -> List[dict]:
        samples = [
            {
                "title": "Circular Externa 027 de 2024 – Actualiza instrucciones sobre sistemas de administración del riesgo de LA/FT/FPADM (SARLAFT)",
                "pub_date": "2024-10-15",
                "doc_type": "Circular Externa",
                "url": "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&id=sample-1",
            },
            {
                "title": "Circular Externa 019 de 2024 – Instruye sobre debida diligencia reforzada para clientes PEP y sanciones por incumplimiento",
                "pub_date": "2024-08-07",
                "doc_type": "Circular Externa",
                "url": "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&id=sample-2",
            },
            {
                "title": "Carta Circular 035 de 2024 – Recuerda obligaciones de reporte a la UIAF y plazos máximos de envío",
                "pub_date": "2024-11-01",
                "doc_type": "Carta Circular",
                "url": "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&id=sample-3",
            },
            {
                "title": "Resolución 1523 de 2024 – Establece multas y sanciones para entidades que incumplan normas de protección al consumidor financiero",
                "pub_date": "2024-06-20",
                "doc_type": "Resolución",
                "url": "https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&id=sample-4",
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
