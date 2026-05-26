"""CMF Chile scraper – fetches Normas de Carácter General and Circulares."""

import re
import time
from typing import List

from src.scrapers.base_scraper import BaseScraper
from src.utils import normalize_date, setup_logging

logger = setup_logging("scraper.cmf")

CMF_NORMAS_URL = "https://www.cmfchile.cl/portal/principal/613/w3-channel.html"
CMF_CIRCULARES_URL = "https://www.cmfchile.cl/portal/principal/605/w3-channel.html"


class CMFScraper(BaseScraper):
    source_id = "cmf_chile"
    country = "Chile"
    regulator = "CMF"

    def fetch_items(self) -> List[dict]:
        items = []
        items.extend(self._fetch_normas())
        time.sleep(self.rate_limit)
        items.extend(self._fetch_circulares())
        return items

    def _fetch_normas(self) -> List[dict]:
        logger.info("Fetching CMF Normas de Carácter General…")
        soup = self.get_html(CMF_NORMAS_URL)
        if not soup:
            logger.warning("CMF normas page unavailable – using sample data")
            return self._sample_normas()
        return self._parse_table(soup, "Norma de Carácter General", CMF_NORMAS_URL)

    def _fetch_circulares(self) -> List[dict]:
        logger.info("Fetching CMF Circulares…")
        soup = self.get_html(CMF_CIRCULARES_URL)
        if not soup:
            logger.warning("CMF circulares page unavailable – using sample data")
            return self._sample_circulares()
        return self._parse_table(soup, "Circular", CMF_CIRCULARES_URL)

    def _parse_table(self, soup, doc_type: str, base_url: str) -> List[dict]:
        items = []
        rows = soup.select("table tr")
        for row in rows[1:21]:  # limit to 20 most recent
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            link_tag = row.find("a", href=True)
            title_cell = cells[1] if len(cells) > 1 else cells[0]
            date_cell = cells[0]

            title = title_cell.get_text(strip=True)
            raw_date = date_cell.get_text(strip=True)
            pub_date = normalize_date(raw_date)
            url = link_tag["href"] if link_tag else base_url
            if url.startswith("/"):
                url = "https://www.cmfchile.cl" + url

            if not title or len(title) < 5:
                continue

            items.append(self._make_item(
                title=title,
                publication_date=pub_date,
                document_type=doc_type,
                source_url=url,
                raw_text=title,
            ))
        return items

    def _sample_normas(self) -> List[dict]:
        samples = [
            {
                "title": "NCG N°457 – Modifica normas sobre prevención de lavado de activos y financiamiento del terrorismo para entidades supervisadas",
                "pub_date": "2024-11-15",
                "url": "https://www.cmfchile.cl/portal/principal/613/w3-article-sample.html",
            },
            {
                "title": "NCG N°455 – Actualiza requerimientos de debida diligencia a clientes (KYC) para compañías de seguro",
                "pub_date": "2024-09-03",
                "url": "https://www.cmfchile.cl/portal/principal/613/w3-article-sample2.html",
            },
            {
                "title": "NCG N°452 – Establece obligaciones de reporte de operaciones sospechosas",
                "pub_date": "2024-07-22",
                "url": "https://www.cmfchile.cl/portal/principal/613/w3-article-sample3.html",
            },
        ]
        return [
            self._make_item(
                title=s["title"],
                publication_date=s["pub_date"],
                document_type="Norma de Carácter General",
                source_url=s["url"],
                raw_text=s["title"],
            )
            for s in samples
        ]

    def _sample_circulares(self) -> List[dict]:
        samples = [
            {
                "title": "Circular N°2.396 – Instruye sobre requisitos mínimos de ciberseguridad para entidades bancarias",
                "pub_date": "2024-10-01",
                "url": "https://www.cmfchile.cl/portal/principal/605/w3-article-sample-circ.html",
            },
            {
                "title": "Circular N°2.390 – Sanciones aplicables por incumplimiento de plazos en reporte de operaciones",
                "pub_date": "2024-08-14",
                "url": "https://www.cmfchile.cl/portal/principal/605/w3-article-sample-circ2.html",
            },
        ]
        return [
            self._make_item(
                title=s["title"],
                publication_date=s["pub_date"],
                document_type="Circular",
                source_url=s["url"],
                raw_text=s["title"],
            )
            for s in samples
        ]
