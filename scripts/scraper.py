#!/usr/bin/env python3
"""
Regulatory scraper – Radar Regulatorio Global66 Chile
Fuentes: CMF, UAF, BCCh, Diario Oficial, Congreso/BCN, SERNAC, OFAC
Corre en GitHub Actions L-V 09:00 UTC y escribe:
  - docs/data/regulatory_items.json   (nuevas normativas detectadas)
  - docs/data/sources_status.json     (estado por fuente: ultima revision, items encontrados)
"""

import hashlib
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict

import requests
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("scraper")

ROOT        = Path(__file__).parent.parent
ITEMS_FILE  = ROOT / "docs" / "data" / "regulatory_items.json"
STATUS_FILE = ROOT / "docs" / "data" / "sources_status.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Keywords that signal relevance to Global66 (fintech + payments + AML + consumer + data)
RELEVANT_KEYWORDS = [
    # Fintech / pagos / emisores
    "fintech","tarjeta","tarjetas","pago","pagos","transferencia","emisor","emisores",
    "prepago","billetera","wallet","plataforma de pagos","sistema de pagos",
    "operadores de medios","infraestructura de datos","proveedor de servicios de pago",
    # AML/CFT/PADM
    "lavado","financiamiento del terrorismo","la/ft","ala/cft","pep","sarlaft",
    "debida diligencia","ros","ros reportes","uaf","beneficiario final",
    "proliferación","activos virtuales","criptoactivos","sanciones ofac",
    # Datos personales / ciberseguridad
    "datos personales","protección de datos","ciberseguridad","ciber","ley 21.719",
    "ley 21719","anci","csirt","marco de ciberseguridad",
    # Consumidor financiero
    "consumidor","sernac","protección al consumidor","servicio al cliente",
    "transparencia","información al cliente","tasas de interés","costo financiero",
    # Gobierno corporativo / penal
    "responsabilidad penal","delitos económicos","libre competencia","gobierno corporativo",
    # Regulación cambiaria
    "cambios internacionales","divisas","tipo de cambio","subchile","bcch","remesas",
    # CMF / SVS aplicable
    "ncg","norma de carácter general","circular cmf","resolución exenta",
    "compendio normativo","registro de valores","mercado de valores",
    # Tipo de norma relevante
    "ley n°21","ley n°20.950","ley 20950","ley n°19.913","ley 19913",
    "decreto supremo","resolución exenta","instrucción","instrucciones",
]

RELEVANT_RE = re.compile(
    "|".join(re.escape(k) for k in RELEVANT_KEYWORDS),
    re.IGNORECASE
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_existing() -> List[dict]:
    if ITEMS_FILE.exists():
        return json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    return []


def save_items(items: List[dict]) -> None:
    ITEMS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ITEMS_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("Saved %d items to %s", len(items), ITEMS_FILE)


def load_status() -> Dict:
    if STATUS_FILE.exists():
        return json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    return {}


def save_status(status: Dict) -> None:
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATUS_FILE.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()[:16]


MONTH_MAP = {
    "enero":"01","febrero":"02","marzo":"03","abril":"04","mayo":"05","junio":"06",
    "julio":"07","agosto":"08","septiembre":"09","octubre":"10","noviembre":"11","diciembre":"12",
    "jan":"01","feb":"02","mar":"03","apr":"04","may":"05","jun":"06",
    "jul":"07","aug":"08","sep":"09","oct":"10","nov":"11","dec":"12",
}

def normalize_date(raw: str) -> Optional[str]:
    if not raw:
        return None
    s = raw.strip().lower()
    for es, num in MONTH_MAP.items():
        s = s.replace(es, num)
    for fmt in ["%d/%m/%Y","%d-%m-%Y","%Y-%m-%d","%d %m %Y","%d de %m de %Y",
                "%d %m %y","%m/%d/%Y","%B %d, %Y","%d/%m/%y"]:
        try:
            return datetime.strptime(s.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    m = re.search(r"\b(20\d{2})\b", raw)
    return f"{m.group(1)}-01-01" if m else None


def get_html(url: str, timeout: int = 22, retries: int = 2) -> Optional[BeautifulSoup]:
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            r.raise_for_status()
            if len(r.text) < 400:
                log.warning("Page too small (%d bytes): %s", len(r.text), url)
                return None
            return BeautifulSoup(r.text, "lxml")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(3)
            else:
                log.warning("Failed to fetch %s: %s", url, e)
    return None


def _make(title: str, pub_date: Optional[str], doc_type: str, url: str,
          regulator: str, identifier: str = "", regulated_subject: str = "") -> dict:
    """Build a new regulatory item dict matching the 28-field normogram schema."""
    clean_title = re.sub(r"\s+", " ", title).strip()
    return {
        # Required normogram fields
        "country":                "Chile",
        "entity_applicable":      "Ambas",          # default, analyst reviews
        "document_type":          doc_type,
        "title":                  clean_title,
        "identifier":             identifier,
        "publication_date":       pub_date,
        "effective_date":         None,
        "regulator":              regulator,
        "norm_state":             "Vigente",
        "regulated_subject":      regulated_subject or _infer_subject(clean_title),
        "executive_summary":      None,              # AI fills this
        "main_obligations":       None,
        "responsible_area":       _infer_area(clean_title),
        "impact_legal":           None,              # AI scores this
        "impact_operational":     None,
        "impact_technological":   None,
        "impact_aml_cft":         None,
        "impact_customer":        None,
        "risk_consolidated":      None,
        "required_actions":       None,
        "implementation_deadline":None,
        "implementation_status":  "Pendiente",
        "expected_evidence":      None,
        "source_url":             url,
        "observations":           None,
        "last_review_date":       datetime.now().strftime("%d/%m/%Y"),
        "responsible_update":     "GitHub Actions – scraper.py",
        # Compat / system fields
        "status":                 "nuevo",
        "detected_at":            datetime.now().isoformat(timespec="seconds"),
        "content_hash":           compute_hash(clean_title),
    }


def _infer_subject(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ["lavado","la/ft","ala/cft","terrorismo","uaf"]):
        return "AML/CFT/PADM"
    if any(k in t for k in ["fintech","psp","prestador de servicios de pago"]):
        return "Fintech / PSP"
    if any(k in t for k in ["tarjeta","emisor","medios de pago","transferencia"]):
        return "Medios de Pago"
    if any(k in t for k in ["datos personales","protección de datos","gdpr"]):
        return "Protección de Datos"
    if any(k in t for k in ["ciber","anci","csirt","seguridad informática"]):
        return "Ciberseguridad"
    if any(k in t for k in ["consumidor","sernac","transparencia"]):
        return "Consumidor Financiero"
    if any(k in t for k in ["sanciones","ofac","lista","sdnlist"]):
        return "Sanciones Internacionales"
    if any(k in t for k in ["cambio","divisa","remesa","transferencia al exterior"]):
        return "Regulación Cambiaria"
    if any(k in t for k in ["gobierno corporativo","directorio","junta","sociedad anónima"]):
        return "Gobierno Corporativo"
    return "Normativa General"


def _infer_area(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ["lavado","ala/cft","la/ft","uaf","terrorismo","pep","sanciones","ofac"]):
        return "Compliance / AML"
    if any(k in t for k in ["datos","privacidad","ciber","seguridad"]):
        return "Tecnología / Legal"
    if any(k in t for k in ["consumidor","sernac","transparencia","quejas"]):
        return "CX / Legal"
    return "Compliance / Legal"


def is_relevant(title: str, extra_text: str = "") -> bool:
    return bool(RELEVANT_RE.search(title + " " + extra_text))


# ─────────────────────────────────────────────────────────────────────────────
# Source scrapers
# ─────────────────────────────────────────────────────────────────────────────

def scrape_cmf() -> List[dict]:
    """
    CMF – Comisión para el Mercado Financiero
    Strategy: parse the main homepage news links + dedicated normas pages.
    CMF uses Liferay (JS heavy) so we parse what loads statically.
    """
    items = []
    SOURCE = "CMF"

    # 1) Main page – extract article/news links
    soup = get_html("https://www.cmfchile.cl")
    if soup:
        for a in soup.find_all("a", href=True):
            t   = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15 or "article" not in href.lower():
                continue
            if not is_relevant(t):
                continue
            full = href if href.startswith("http") else "https://www.cmfchile.cl" + href
            doc_type = _cmf_doc_type(t)
            items.append(_make(t, None, doc_type, full, SOURCE))

    # 2) Try specific normativa pages
    norm_pages = [
        ("https://www.cmfchile.cl/portal/principal/613/w3-channel.html", "NCG"),
        ("https://www.cmfchile.cl/portal/principal/605/w3-channel.html", "Circular"),
    ]
    for url, dtype in norm_pages:
        soup2 = get_html(url)
        if not soup2:
            continue
        for row in soup2.select("table tr")[1:20]:
            cells = row.find_all(["td","th"])
            link  = row.find("a", href=True)
            if len(cells) < 2 or not link:
                continue
            title    = cells[-1].get_text(strip=True) if len(cells) > 1 else ""
            raw_date = cells[0].get_text(strip=True)
            if len(title) < 10:
                continue
            href = link["href"]
            if href.startswith("/"):
                href = "https://www.cmfchile.cl" + href
            items.append(_make(title, normalize_date(raw_date), dtype, href, SOURCE))
        time.sleep(1.5)

    # Deduplicate by hash
    seen: set = set()
    result = []
    for it in items:
        if it["content_hash"] not in seen:
            seen.add(it["content_hash"])
            result.append(it)

    log.info("CMF: %d items", len(result))
    return result


def _cmf_doc_type(title: str) -> str:
    t = title.lower()
    if "ncg" in t or "norma de carácter general" in t or "n.c.g" in t:
        return "NCG"
    if "circular" in t:
        return "Circular"
    if "resolución" in t or "resolucion" in t:
        return "Resolución"
    if "compendio" in t:
        return "Compendio"
    return "Norma CMF"


def scrape_uaf() -> List[dict]:
    """
    UAF – Unidad de Análisis Financiero
    Direct scrape works: extracts circular titles and dates from the normativa page.
    """
    items = []
    SOURCE = "UAF"
    url    = "https://www.uaf.cl/es-cl/normativa/circulares-uaf"
    soup   = get_html(url)

    if not soup:
        log.warning("UAF: page unavailable")
        return []

    # Find circular blocks – each has pattern "Circular N°XX : Title \n Date"
    CIRC_RE = re.compile(r"Circular\s+N[°o]?\d+", re.IGNORECASE)
    seen_texts: set = set()

    for elem in soup.find_all(["p","li","div","td"]):
        text = elem.get_text(separator=" ", strip=True)
        if not CIRC_RE.search(text) or len(text) > 400:
            continue
        # Clean up title
        # Remove "Descargar" suffix
        clean = re.sub(r"\s*Descargar\s*$", "", text).strip()
        # Extract date
        date_m = re.search(r"(\d{1,2}\s+\w{3,9}\s+\d{4})", clean)
        pub_date = normalize_date(date_m.group(1)) if date_m else None
        # Remove date from title
        title = re.sub(r"\d{1,2}\s+\w{3,9}\s+\d{4}", "", clean).strip(" :-")
        if len(title) < 10 or title[:30] in seen_texts:
            continue
        seen_texts.add(title[:30])
        # Find link
        link = elem.find("a", href=True)
        href = "https://www.uaf.cl" + link["href"] if link and link["href"].startswith("/") else url
        # Identifier
        id_m = re.search(r"(Circular\s+N[°o]?\d+)", title, re.IGNORECASE)
        identifier = id_m.group(1) if id_m else ""
        items.append(_make(title, pub_date, "Circular", href, SOURCE, identifier, "AML/CFT/PADM"))

    # Also check normativa-en-consulta
    soup2 = get_html("https://www.uaf.cl/es-cl/normativa/normativa-en-consulta")
    if soup2:
        for a in soup2.find_all("a", href=True):
            t = a.get_text(strip=True)
            if len(t) < 15:
                continue
            href = a["href"]
            if href.startswith("/"):
                href = "https://www.uaf.cl" + href
            items.append(_make(t, None, "Consulta Pública", href, SOURCE, "", "AML/CFT/PADM"))

    log.info("UAF: %d items", len(items))
    return items


def scrape_bcch() -> List[dict]:
    """
    Banco Central de Chile (BCCh)
    Scrapes the CNCI normativa page and searches for relevant chapters.
    Falls back to known important chapters if JS-rendered.
    """
    items = []
    SOURCE = "Banco Central de Chile"

    # Try the BCCh search / normativa pages
    pages = [
        "https://www.bcentral.cl/web/banco-central/recopilacion-actualizada-de-normas",
        "https://www.bcentral.cl/web/banco-central/normativa-y-legislacion",
    ]
    for url in pages:
        soup = get_html(url)
        if not soup or len(soup.get_text()) < 200:
            continue
        for a in soup.find_all("a", href=True):
            t = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 10:
                continue
            if any(k in t.lower() for k in
                   ["capítulo","cap.","resolución","circular","cnci","compendio","norma"]):
                if href.startswith("/"):
                    href = "https://www.bcentral.cl" + href
                items.append(_make(t, None, _bcch_doc_type(t), href, SOURCE))
        time.sleep(1.5)

    # Add known always-relevant BCCh chapters for Global66
    known = [
        ("Capítulo III.J – Prevención del Lavado de Activos y Financiamiento del Terrorismo",
         "https://www.bcentral.cl/web/banco-central/recopilacion-actualizada-de-normas",
         "Compendio Normas de Cambios Internacionales"),
        ("Capítulo I – Principios Generales del Sistema de Pagos (CNCI)",
         "https://www.bcentral.cl/web/banco-central/recopilacion-actualizada-de-normas",
         "Compendio Normas Sistemas de Pago"),
    ]
    for title, url, subj in known:
        items.append(_make(title, None, "Capítulo CNCI", url, SOURCE, "", subj))

    log.info("BCCh: %d items", len(items))
    return items


def _bcch_doc_type(title: str) -> str:
    t = title.lower()
    if "capítulo" in t or "cap." in t:
        return "Capítulo CNCI"
    if "resolución" in t:
        return "Resolución"
    if "circular" in t:
        return "Circular"
    return "Norma BCCh"


def scrape_diario_oficial() -> List[dict]:
    """
    Diario Oficial – recent editions looking for laws, decrees, resolutions
    relevant to fintech, payments, AML, consumer protection.
    Checks last 30 days of editions.
    """
    items = []
    SOURCE = "Diario Oficial"
    today = datetime.now()

    for days_back in range(0, 30):
        date = today - timedelta(days=days_back)
        if date.weekday() >= 5:      # Skip weekends (DO doesn't publish)
            continue
        url  = (f"https://www.diariooficial.interior.gob.cl/edicionelectronica/"
                f"index.php?date={date.strftime('%Y-%m-%d')}")
        soup = get_html(url)
        if not soup:
            continue
        page_text = soup.get_text()
        if len(page_text.strip()) < 200:
            continue

        pub_date_str = date.strftime("%Y-%m-%d")

        # Parse all links in the sumario
        for a in soup.find_all("a", href=True):
            t    = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15:
                continue
            doc_type = _do_doc_type(t)
            if not doc_type:
                continue
            if not is_relevant(t):
                continue
            if href.startswith("/"):
                href = "https://www.diariooficial.interior.gob.cl" + href
            # Extract identifier
            id_m = re.search(r"(Ley\s+N°\s*[\d\.]+|Decreto\s+N°?\s*\d+|Resolución\s+Exenta\s+N°?\s*\d+|DS\s+N°?\s*\d+)", t, re.IGNORECASE)
            identifier = id_m.group(0) if id_m else ""
            items.append(_make(t, pub_date_str, doc_type, href, SOURCE, identifier))

        # Check if we got any content for this date
        if items:
            log.info("DO edition %s: found relevant items so far=%d", pub_date_str, len(items))
        time.sleep(1)

    log.info("Diario Oficial: %d items total", len(items))
    return items


def _do_doc_type(title: str) -> str:
    t = title.lower()
    if re.search(r"ley\s+n[°o]?\s*\d", t):
        return "Ley"
    if re.search(r"decreto\s+ley", t):
        return "Decreto Ley"
    if re.search(r"decreto\s+supremo|ds\s+n[°o]?\s*\d", t):
        return "Decreto Supremo"
    if re.search(r"decreto\s+n[°o]?\s*\d", t):
        return "Decreto"
    if re.search(r"resolución\s+exenta|res\.\s+ex", t):
        return "Resolución Exenta"
    if re.search(r"resolución\s+n[°o]?\s*\d|resolución", t):
        return "Resolución"
    if re.search(r"instrucción|instrucciones", t):
        return "Instrucción"
    return ""   # Not a recognized norm type


def scrape_sernac() -> List[dict]:
    """
    SERNAC – Servicio Nacional del Consumidor
    Scrapes consumer financial normativa section.
    """
    items = []
    SOURCE = "SERNAC"
    pages  = [
        "https://www.sernac.cl/portal/604/w3-channel.html",
        "https://www.sernac.cl/portal/604/w3-propertyname-539.html",
    ]

    for url in pages:
        soup = get_html(url)
        if not soup:
            continue
        for a in soup.find_all("a", href=True):
            t    = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15:
                continue
            if not any(k in t.lower() for k in
                       ["resoluc","circular","instruc","reglam","decreto","norma","exenta"]):
                continue
            if href.startswith("/"):
                href = "https://www.sernac.cl" + href
            doc_type = "Resolución" if "resoluc" in t.lower() else "Circular"
            items.append(_make(t, None, doc_type, href, SOURCE, "", "Consumidor Financiero"))
        time.sleep(1)

    log.info("SERNAC: %d items", len(items))
    return items


def scrape_congreso() -> List[dict]:
    """
    Congreso Nacional / BCN
    Searches for bills (proyectos de ley) related to fintech, payments, AML.
    Uses the BCN search form which returns static HTML.
    """
    items = []
    SOURCE = "Congreso Nacional"

    # BCN search for recent bills with relevant keywords
    keywords = ["fintech","pagos","emisores de tarjetas","lavado de activos","datos personales",
                "ciberseguridad","consumidor financiero","activos virtuales"]

    for kw in keywords[:4]:    # Limit to avoid rate limiting
        url = (f"https://www.bcn.cl/leychile/consulta/listaresultadosimple"
               f"?tipo_norma=&fpromo=2024-01-01&fpromoh=&org=&buscar={requests.utils.quote(kw)}")
        soup = get_html(url)
        if not soup:
            continue
        for a in soup.find_all("a", href=True):
            t    = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15:
                continue
            if href.startswith("/"):
                href = "https://www.bcn.cl" + href
            if "navegar" not in href and "project" not in href.lower():
                continue
            doc_type = "Proyecto de Ley" if "proyecto" in t.lower() else "Ley"
            items.append(_make(t, None, doc_type, href, SOURCE))
        time.sleep(2)

    log.info("Congreso: %d items", len(items))
    return items


def scrape_ofac() -> List[dict]:
    """
    OFAC – Office of Foreign Assets Control (US Treasury)
    Monitors recent SDN list updates relevant to global compliance.
    """
    items = []
    SOURCE = "OFAC / GAFI"
    url    = "https://ofac.treasury.gov/recent-actions/"
    soup   = get_html(url)
    if not soup:
        return []

    text  = soup.get_text(separator=" ")
    today = datetime.now()

    # Extract action entries using regex pattern from the page text
    # Format: "Action Title Month DD, YYYY - Sanctions List Updates"
    ACTION_RE = re.compile(
        r"([A-Z][^\n]{10,120}?)\s+(January|February|March|April|May|June|July|"
        r"August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})"
        r"(?:\s*-\s*Sanctions\s+List\s+Updates)?",
        re.IGNORECASE
    )
    seen_titles: set = set()
    for m in ACTION_RE.finditer(text):
        title    = m.group(1).strip()
        month    = m.group(2)
        day      = m.group(3)
        year     = m.group(4)
        date_str = normalize_date(f"{day} {month[:3]} {year}") or f"{year}-01-01"

        # Only last 90 days
        try:
            item_date = datetime.strptime(date_str, "%Y-%m-%d")
            if (today - item_date).days > 90:
                continue
        except ValueError:
            pass

        key = title[:40]
        if key in seen_titles:
            continue
        seen_titles.add(key)

        full_title = f"OFAC – {title}"
        items.append(_make(
            full_title, date_str, "Alerta Sanciones",
            url, SOURCE, f"OFAC {date_str}", "Sanciones Internacionales"
        ))

    log.info("OFAC: %d items (last 90 days)", len(items))
    return items


def scrape_fatf_gafilat() -> List[dict]:
    """
    GAFI / GAFILAT – international AML standards
    Tries GAFILAT first, then FATF (frequently returns 403).
    """
    items = []
    SOURCE = "GAFI / GAFILAT"

    gafilat_urls = [
        "https://www.gafilat.org/index.php/es/",
        "https://www.gafilat.org/index.php/es/noticias",
    ]
    for url in gafilat_urls:
        soup = get_html(url)
        if not soup:
            continue
        for a in soup.find_all("a", href=True):
            t    = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15:
                continue
            if any(k in t.lower() for k in
                   ["informe","evaluación","recomendación","estándar","guía","actualización","revisión"]):
                if href.startswith("/"):
                    href = "https://www.gafilat.org" + href
                items.append(_make(t, None, "Estándar Internacional", href, SOURCE))
        if items:
            break
        time.sleep(1.5)

    log.info("GAFI/GAFILAT: %d items", len(items))
    return items


def scrape_agencia_datos() -> List[dict]:
    """
    Agencia de Protección de Datos Personales (Chile)
    New agency under Ley N°21.719 – check for instructions and circulars.
    """
    items = []
    SOURCE = "Agencia de Protección de Datos"
    urls   = [
        "https://agenciadepd.cl/normativa/",
        "https://www.agenciadepd.cl",
    ]
    for url in urls:
        soup = get_html(url)
        if not soup:
            continue
        for a in soup.find_all("a", href=True):
            t    = a.get_text(strip=True)
            href = a["href"]
            if len(t) < 15:
                continue
            if any(k in t.lower() for k in
                   ["resoluc","instruc","circular","reglam","guía","directriz","norma"]):
                if href.startswith("/"):
                    href = url.rstrip("/") + "/" + href.lstrip("/")
                items.append(_make(t, None, "Instrucción", href, SOURCE, "", "Protección de Datos"))
        if items:
            break
        time.sleep(1)

    log.info("Agencia Datos: %d items", len(items))
    return items


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

SCRAPERS = [
    ("CMF",                    scrape_cmf),
    ("UAF",                    scrape_uaf),
    ("Banco Central de Chile", scrape_bcch),
    ("Diario Oficial",         scrape_diario_oficial),
    ("SERNAC",                 scrape_sernac),
    ("Congreso Nacional",      scrape_congreso),
    ("OFAC / GAFI",            scrape_ofac),
    ("GAFI / GAFILAT",         scrape_fatf_gafilat),
    ("Agencia de Datos",       scrape_agencia_datos),
]


def main():
    existing      = load_existing()
    known_hashes  = {i.get("content_hash","") for i in existing}
    next_id       = max((i.get("id", 0) for i in existing if isinstance(i.get("id"), int)), default=0) + 1
    status        = load_status()
    now_iso       = datetime.now().isoformat(timespec="seconds")

    new_items: List[dict] = []
    for source_name, scraper_fn in SCRAPERS:
        log.info("─── Scraping: %s", source_name)
        status.setdefault(source_name, {})
        try:
            scraped   = scraper_fn()
            new_count = 0
            for item in scraped:
                h = item.get("content_hash","")
                if h and h not in known_hashes:
                    item["id"] = next_id
                    next_id += 1
                    new_items.append(item)
                    known_hashes.add(h)
                    new_count += 1
            status[source_name] = {
                "last_checked":     now_iso,
                "status":           "ok",
                "new_items_found":  new_count,
                "total_scraped":    len(scraped),
                "error":            None,
            }
            log.info("  %s: %d scraped, %d new", source_name, len(scraped), new_count)
        except Exception as exc:
            log.error("  %s FAILED: %s", source_name, exc)
            status[source_name] = {
                "last_checked":    now_iso,
                "status":          "error",
                "new_items_found": 0,
                "total_scraped":   0,
                "error":           str(exc),
            }
        time.sleep(2)    # Polite delay between sources

    log.info("Total new items: %d", len(new_items))
    all_items = existing + new_items
    save_items(all_items)
    save_status(status)
    log.info("Done. Total normativas: %d", len(all_items))


if __name__ == "__main__":
    main()
