"""Generic configurable scraper using sources.yaml definitions."""

from typing import List

from src.scrapers.base_scraper import BaseScraper
from src.utils import normalize_date, setup_logging

logger = setup_logging("scraper.generic")


class GenericScraper(BaseScraper):
    """Driven entirely by source config from sources.yaml."""

    def __init__(self, source_config: dict, scraping_config: dict = None):
        super().__init__(scraping_config)
        self.source_id = source_config.get("id", "generic")
        self.country = source_config.get("country", "")
        self.regulator = source_config.get("name", "")
        self._source = source_config

    def fetch_items(self) -> List[dict]:
        list_url = self._source.get("list_url") or self._source.get("base_url", "")
        doc_types = self._source.get("document_types", ["Documento"])
        default_doc_type = doc_types[0] if doc_types else "Documento"

        item_sel = self._source.get("item_selector", "table tr")
        title_sel = self._source.get("title_selector", "td:nth-child(2)")
        date_sel = self._source.get("date_selector", "td:nth-child(1)")
        link_sel = self._source.get("link_selector", "a")

        logger.info("GenericScraper fetching %s from %s", self.source_id, list_url)
        soup = self.get_html(list_url)
        if not soup:
            logger.warning("Generic scraper: could not reach %s", list_url)
            return []

        items = []
        rows = soup.select(item_sel)
        for row in rows[1:21]:  # skip header, limit 20
            try:
                title_el = row.select_one(title_sel)
                date_el = row.select_one(date_sel)
                link_el = row.select_one(link_sel)

                title = title_el.get_text(strip=True) if title_el else row.get_text(strip=True)
                raw_date = date_el.get_text(strip=True) if date_el else ""
                pub_date = normalize_date(raw_date)
                href = link_el["href"] if link_el and link_el.get("href") else list_url
                if href.startswith("/"):
                    base = self._source.get("base_url", "")
                    href = base + href

                if not title or len(title) < 5:
                    continue

                doc_type = default_doc_type
                for dt in doc_types:
                    if dt.lower() in title.lower():
                        doc_type = dt
                        break

                items.append(self._make_item(
                    title=title,
                    publication_date=pub_date,
                    document_type=doc_type,
                    source_url=href,
                    raw_text=title,
                ))
            except Exception as e:
                logger.debug("Row parse error: %s", e)

        logger.info("GenericScraper %s: found %d items", self.source_id, len(items))
        return items
