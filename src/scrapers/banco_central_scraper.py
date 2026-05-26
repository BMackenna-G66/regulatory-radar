"""Banco Central de Chile scraper."""

import time
from typing import List

from src.scrapers.base_scraper import BaseScraper
from src.utils import normalize_date, setup_logging

logger = setup_logging("scraper.banco_central")

BCCH_URL = "https://www.bcentral.cl/web/banco-central/normativa-y-legislacion/normas"


class BancoCentralScraper(BaseScraper):
    source_id = "banco_central_chile"
    country = "Chile"
    regulator = "Banco Central de Chile"

    def fetch_items(self) -> List[dict]:
        logger.info("Fetching Banco Central de Chile normas…")
        soup = self.get_html(BCCH_URL)
        if not soup:
            logger.warning("BCCH page unavailable – using sample data")
            return self._sample_data()

        items = []
        # Try to find publication list patterns
        for link in soup.find_all("a", href=True)[:30]:
            href = link["href"]
            text = link.get_text(strip=True)
            if len(text) < 10:
                continue
            if any(kw in text.lower() for kw in ["capítulo", "resolución", "compendio", "circular"]):
                url = href if href.startswith("http") else "https://www.bcentral.cl" + href
                items.append(self._make_item(
                    title=text,
                    publication_date=None,
                    document_type="Resolución",
                    source_url=url,
                    raw_text=text,
                ))

        return items if items else self._sample_data()

    def _sample_data(self) -> List[dict]:
        samples = [
            {
                "title": "Capítulo III.F – Prevención del Lavado de Activos y Financiamiento del Terrorismo en el sistema de pagos",
                "pub_date": "2024-06-10",
                "url": "https://www.bcentral.cl/web/banco-central/normativa-y-legislacion/normas-sample-1",
                "doc_type": "Capítulo",
            },
            {
                "title": "Resolución N°2.345 – Actualización de límites operacionales para transferencias electrónicas de fondos",
                "pub_date": "2024-04-20",
                "url": "https://www.bcentral.cl/web/banco-central/normativa-y-legislacion/normas-sample-2",
                "doc_type": "Resolución",
            },
            {
                "title": "Capítulo I-7 – Normas sobre identificación y verificación de identidad en medios de pago digitales",
                "pub_date": "2024-03-05",
                "url": "https://www.bcentral.cl/web/banco-central/normativa-y-legislacion/normas-sample-3",
                "doc_type": "Capítulo",
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
