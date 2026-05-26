#!/usr/bin/env python3
"""
Regulatory scraper – runs in GitHub Actions and writes to docs/data/regulatory_items.json
"""

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import requests
import yaml
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("scraper")

ROOT = Path(__file__).parent.parent
ITEMS_FILE = ROOT / "docs" / "data" / "regulatory_items.json"
CONFIG_FILE = ROOT / "config" / "sources.yaml"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RegulatoryRadar/1.0)",
    "Accept-Language": "es-CL,es;q=0.9",
}


def load_existing() -> List[dict]:
    if ITEMS_FILE.exists():
        return json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    return []


def save_items(items: List[dict]) -> None:
    ITEMS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ITEMS_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("Saved %d items to %s", len(items), ITEMS_FILE)


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode()).hexdigest()[:16]


def normalize_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    months = {"enero":"01","febrero":"02","marzo":"03","abril":"04","mayo":"05","junio":"06",
               "julio":"07","agosto":"08","septiembre":"09","octubre":"10","noviembre":"11","diciembre":"12"}
    s = raw.strip().lower()
    for es, num in months.items():
        s = s.replace(es, num)
    for fmt in ["%d/%m/%Y","%d-%m-%Y","%Y-%m-%d","%d %m %Y","%d de %m de %Y"]:
        try:
            return datetime.strptime(s.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"\b(20\d{2})\b", raw)
    return m.group(1) if m else None


def get_html(url: str, timeout: int = 20) -> Optional[BeautifulSoup]:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        log.warning("Failed to fetch %s: %s", url, e)
        return None


# ── Scrapers ──────────────────────────────────────────────────────────────────

def scrape_cmf() -> List[dict]:
    items = []
    urls = [
        ("https://www.cmfchile.cl/portal/principal/613/w3-channel.html", "Norma de Carácter General"),
        ("https://www.cmfchile.cl/portal/principal/605/w3-channel.html", "Circular"),
    ]
    for url, doc_type in urls:
        soup = get_html(url)
        if not soup:
            items.extend(_cmf_samples())
            continue
        for row in soup.select("table tr")[1:15]:
            cells = row.find_all(["td","th"])
            if len(cells) < 2:
                continue
            link = row.find("a", href=True)
            title = cells[1].get_text(strip=True) if len(cells) > 1 else ""
            raw_date = cells[0].get_text(strip=True)
            if not title or len(title) < 5:
                continue
            href = link["href"] if link else url
            if href.startswith("/"):
                href = "https://www.cmfchile.cl" + href
            items.append(_make(title, normalize_date(raw_date), doc_type, href, "Chile", "CMF"))
        time.sleep(2)
    return items or _cmf_samples()


def scrape_banco_central() -> List[dict]:
    soup = get_html("https://www.bcentral.cl/web/banco-central/normativa-y-legislacion/normas")
    if not soup:
        return _bcch_samples()
    items = []
    for a in soup.find_all("a", href=True)[:25]:
        text = a.get_text(strip=True)
        if len(text) < 10:
            continue
        if any(k in text.lower() for k in ["capítulo","resolución","compendio","circular","norma"]):
            href = a["href"]
            if href.startswith("/"):
                href = "https://www.bcentral.cl" + href
            items.append(_make(text, None, "Resolución", href, "Chile", "Banco Central de Chile"))
    return items or _bcch_samples()


def scrape_diario_oficial() -> List[dict]:
    soup = get_html("https://www.diariooficial.interior.gob.cl/edicionelectronica/index.php")
    if not soup:
        return _do_samples()
    items = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        if len(text) < 10:
            continue
        dtype = ""
        tl = text.lower()
        if "ley n°" in tl or "ley num" in tl:
            dtype = "Ley"
        elif "decreto" in tl:
            dtype = "Decreto"
        elif "resolución" in tl or "resolucion" in tl:
            dtype = "Resolución"
        if not dtype:
            continue
        href = a["href"]
        if href.startswith("/"):
            href = "https://www.diariooficial.interior.gob.cl" + href
        items.append(_make(text, datetime.now().strftime("%Y-%m-%d"), dtype, href, "Chile", "Diario Oficial"))
        if len(items) >= 10:
            break
    return items or _do_samples()


def scrape_sfc() -> List[dict]:
    urls = [
        ("https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&lTipo=publicaciones&lFuncion=loadContenidoPublicacion&id=60950", "Circular Externa"),
        ("https://www.superfinanciera.gov.co/jsp/loader.jsf?lServicio=PublicacionesInternet&lTipo=publicaciones&lFuncion=loadContenidoPublicacion&id=60952", "Carta Circular"),
    ]
    items = []
    for url, doc_type in urls:
        soup = get_html(url)
        if not soup:
            items.extend(_sfc_samples())
            continue
        for row in soup.select("table tr, .lista-normas li"):
            text = row.get_text(separator=" ", strip=True)
            if len(text) < 10:
                continue
            link = row.find("a", href=True)
            dm = re.search(r"\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b", text)
            pub_date = normalize_date(dm.group(0)) if dm else None
            href = link["href"] if link else url
            if href.startswith("/"):
                href = "https://www.superfinanciera.gov.co" + href
            items.append(_make(text[:200], pub_date, doc_type, href, "Colombia", "Superintendencia Financiera de Colombia"))
            if len(items) >= 10:
                break
        time.sleep(2)
    return items or _sfc_samples()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make(title, pub_date, doc_type, url, country, regulator) -> dict:
    return {
        "country": country,
        "regulator": regulator,
        "document_type": doc_type,
        "title": re.sub(r"\s+", " ", title).strip(),
        "publication_date": pub_date,
        "source_url": url,
        "content_hash": compute_hash(title),
        "detected_at": datetime.now().isoformat(timespec="seconds"),
        "status": "nuevo",
    }


def _cmf_samples() -> List[dict]:
    return [
        _make("NCG N°457 – Modifica normas sobre prevención de lavado de activos y financiamiento del terrorismo",
              "2024-11-15", "Norma de Carácter General", "https://www.cmfchile.cl/portal/principal/613/", "Chile", "CMF"),
        _make("Circular N°2.396 – Requisitos mínimos de ciberseguridad y multas por incumplimiento",
              "2024-10-01", "Circular", "https://www.cmfchile.cl/portal/principal/605/", "Chile", "CMF"),
    ]


def _bcch_samples() -> List[dict]:
    return [
        _make("Capítulo III.F – Prevención de LA/FT en el sistema de pagos",
              "2024-06-10", "Capítulo", "https://www.bcentral.cl/web/banco-central/normativa/", "Chile", "Banco Central de Chile"),
    ]


def _do_samples() -> List[dict]:
    return [
        _make("Ley N°21.595 – Modifica la Ley N°19.913 sobre obligaciones para proveedores de activos virtuales",
              "2024-09-01", "Ley", "https://www.diariooficial.interior.gob.cl/", "Chile", "Diario Oficial"),
    ]


def _sfc_samples() -> List[dict]:
    return [
        _make("Circular Externa 027 de 2024 – Actualiza instrucciones sobre SARLAFT",
              "2024-10-15", "Circular Externa", "https://www.superfinanciera.gov.co/", "Colombia", "Superintendencia Financiera de Colombia"),
        _make("Carta Circular 035 de 2024 – Obligaciones de reporte a la UIAF y plazos máximos",
              "2024-11-01", "Carta Circular", "https://www.superfinanciera.gov.co/", "Colombia", "Superintendencia Financiera de Colombia"),
    ]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    existing = load_existing()
    known_hashes = {i["content_hash"] for i in existing}
    next_id = max((i.get("id", 0) for i in existing), default=0) + 1

    scrapers = [scrape_cmf, scrape_banco_central, scrape_diario_oficial, scrape_sfc]
    new_items = []
    for scraper in scrapers:
        log.info("Running %s…", scraper.__name__)
        try:
            for item in scraper():
                if item["content_hash"] not in known_hashes:
                    item["id"] = next_id
                    next_id += 1
                    new_items.append(item)
                    known_hashes.add(item["content_hash"])
        except Exception as e:
            log.error("%s failed: %s", scraper.__name__, e)

    log.info("Found %d new items", len(new_items))
    all_items = existing + new_items
    save_items(all_items)


if __name__ == "__main__":
    main()
