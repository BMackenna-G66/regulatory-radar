import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional

import requests
from bs4 import BeautifulSoup

from src import database as db
from src.utils import clean_text, compute_hash, setup_logging

logger = setup_logging("scraper.base")

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class BaseScraper(ABC):
    source_id: str = ""
    country: str = ""
    regulator: str = ""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.timeout = self.config.get("request_timeout", 30)
        self.retry_attempts = self.config.get("retry_attempts", 3)
        self.retry_delay = self.config.get("retry_delay", 5)
        self.rate_limit = self.config.get("rate_limit_delay", 2)
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    @abstractmethod
    def fetch_items(self) -> List[dict]:
        """Fetch raw items from the source. Each item must be a dict ready for DB insert."""
        ...

    def run(self) -> int:
        """Fetch, deduplicate, and save items. Returns count of newly saved items."""
        logger.info("Running scraper: %s", self.__class__.__name__)
        try:
            items = self.fetch_items()
        except Exception as e:
            logger.error("Scraper %s failed: %s", self.__class__.__name__, e)
            return 0

        saved = 0
        for item in items:
            if not item.get("content_hash"):
                item["content_hash"] = compute_hash(item.get("title", "") + item.get("raw_text", ""))
            if db.hash_exists(item["content_hash"]):
                continue
            item.setdefault("detected_at", datetime.now().isoformat())
            item.setdefault("status", "nuevo")
            item_id = db.insert_regulatory_item(item)
            if item_id:
                saved += 1
        logger.info("Scraper %s: saved %d new items (of %d fetched)", self.__class__.__name__, saved, len(items))
        return saved

    def get_html(self, url: str) -> Optional[BeautifulSoup]:
        for attempt in range(self.retry_attempts):
            try:
                resp = self.session.get(url, timeout=self.timeout)
                resp.raise_for_status()
                return BeautifulSoup(resp.text, "lxml")
            except requests.RequestException as e:
                logger.warning("Attempt %d/%d failed for %s: %s", attempt + 1, self.retry_attempts, url, e)
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
        return None

    def _make_item(
        self,
        title: str,
        publication_date: Optional[str],
        document_type: str,
        source_url: str,
        raw_text: str = "",
    ) -> dict:
        text_for_hash = f"{title}{raw_text}"
        return {
            "country": self.country,
            "regulator": self.regulator,
            "document_type": document_type,
            "title": clean_text(title),
            "publication_date": publication_date,
            "source_url": source_url,
            "raw_text": clean_text(raw_text),
            "content_hash": compute_hash(text_for_hash),
            "detected_at": datetime.now().isoformat(),
            "status": "nuevo",
        }
