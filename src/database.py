import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator, List, Optional

from dotenv import load_dotenv

from src.utils import setup_logging

load_dotenv()
logger = setup_logging("database")


def get_db_path() -> Path:
    db_path = os.getenv("DB_PATH", "data/regulatory_radar.db")
    path = Path(__file__).parent.parent / db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    logger.info("Initializing database…")
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS regulatory_items (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                country         TEXT NOT NULL,
                regulator       TEXT NOT NULL,
                document_type   TEXT,
                title           TEXT NOT NULL,
                publication_date TEXT,
                source_url      TEXT NOT NULL,
                raw_text        TEXT,
                content_hash    TEXT UNIQUE NOT NULL,
                detected_at     TEXT NOT NULL,
                status          TEXT NOT NULL DEFAULT 'nuevo'
            );

            CREATE TABLE IF NOT EXISTS ai_analysis (
                id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id                 INTEGER NOT NULL UNIQUE,
                executive_summary       TEXT,
                main_changes            TEXT,
                possible_impact         TEXT,
                affected_areas          TEXT,
                affected_products       TEXT,
                detected_obligations    TEXT,
                max_application_date    TEXT,
                thematic_classification TEXT,
                risk_score              INTEGER DEFAULT 0,
                risk_level              TEXT,
                applies                 TEXT,
                applies_reason          TEXT,
                suggested_area          TEXT,
                criticality             TEXT,
                recommended_action      TEXT,
                analyzed_at             TEXT NOT NULL,
                FOREIGN KEY (item_id) REFERENCES regulatory_items(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS regulatory_tracking (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id             INTEGER NOT NULL,
                applies             TEXT,
                responsible_area    TEXT,
                owner               TEXT,
                due_date            TEXT,
                impact_level        TEXT,
                required_action     TEXT,
                action_plan         TEXT,
                progress_status     TEXT DEFAULT 'pendiente_revision',
                comments            TEXT,
                evidence_url        TEXT,
                last_update         TEXT NOT NULL,
                FOREIGN KEY (item_id) REFERENCES regulatory_items(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_items_country    ON regulatory_items(country);
            CREATE INDEX IF NOT EXISTS idx_items_status     ON regulatory_items(status);
            CREATE INDEX IF NOT EXISTS idx_items_detected   ON regulatory_items(detected_at);
            CREATE INDEX IF NOT EXISTS idx_analysis_score   ON ai_analysis(risk_score);
            CREATE INDEX IF NOT EXISTS idx_tracking_status  ON regulatory_tracking(progress_status);
        """)
    logger.info("Database ready at %s", get_db_path())


# ── regulatory_items ──────────────────────────────────────────────────────────

def insert_regulatory_item(item: dict) -> Optional[int]:
    sql = """
        INSERT OR IGNORE INTO regulatory_items
        (country, regulator, document_type, title, publication_date,
         source_url, raw_text, content_hash, detected_at, status)
        VALUES (:country, :regulator, :document_type, :title, :publication_date,
                :source_url, :raw_text, :content_hash, :detected_at, :status)
    """
    with get_connection() as conn:
        cur = conn.execute(sql, item)
        if cur.lastrowid:
            logger.info("Saved new item id=%s: %s", cur.lastrowid, item["title"][:60])
            return cur.lastrowid
        return None


def get_regulatory_item(item_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM regulatory_items WHERE id = ?", (item_id,)
        ).fetchone()
        return dict(row) if row else None


def get_all_items(filters: dict = None) -> List[dict]:
    sql = "SELECT ri.*, a.risk_score, a.risk_level, a.thematic_classification FROM regulatory_items ri LEFT JOIN ai_analysis a ON ri.id = a.item_id"
    clauses, params = [], []
    if filters:
        if filters.get("country"):
            clauses.append("ri.country = ?")
            params.append(filters["country"])
        if filters.get("status"):
            clauses.append("ri.status = ?")
            params.append(filters["status"])
        if filters.get("regulator"):
            clauses.append("ri.regulator = ?")
            params.append(filters["regulator"])
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY ri.detected_at DESC"
    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def update_item_status(item_id: int, status: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE regulatory_items SET status = ? WHERE id = ?", (status, item_id)
        )


def hash_exists(content_hash: str) -> bool:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM regulatory_items WHERE content_hash = ?", (content_hash,)
        ).fetchone()
        return row is not None


# ── ai_analysis ───────────────────────────────────────────────────────────────

def upsert_ai_analysis(analysis: dict) -> None:
    sql = """
        INSERT INTO ai_analysis
        (item_id, executive_summary, main_changes, possible_impact, affected_areas,
         affected_products, detected_obligations, max_application_date,
         thematic_classification, risk_score, risk_level, applies, applies_reason,
         suggested_area, criticality, recommended_action, analyzed_at)
        VALUES (:item_id, :executive_summary, :main_changes, :possible_impact,
                :affected_areas, :affected_products, :detected_obligations,
                :max_application_date, :thematic_classification, :risk_score,
                :risk_level, :applies, :applies_reason, :suggested_area,
                :criticality, :recommended_action, :analyzed_at)
        ON CONFLICT(item_id) DO UPDATE SET
            executive_summary       = excluded.executive_summary,
            main_changes            = excluded.main_changes,
            possible_impact         = excluded.possible_impact,
            affected_areas          = excluded.affected_areas,
            affected_products       = excluded.affected_products,
            detected_obligations    = excluded.detected_obligations,
            max_application_date    = excluded.max_application_date,
            thematic_classification = excluded.thematic_classification,
            risk_score              = excluded.risk_score,
            risk_level              = excluded.risk_level,
            applies                 = excluded.applies,
            applies_reason          = excluded.applies_reason,
            suggested_area          = excluded.suggested_area,
            criticality             = excluded.criticality,
            recommended_action      = excluded.recommended_action,
            analyzed_at             = excluded.analyzed_at
    """
    with get_connection() as conn:
        conn.execute(sql, analysis)


def get_ai_analysis(item_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM ai_analysis WHERE item_id = ?", (item_id,)
        ).fetchone()
        return dict(row) if row else None


def get_items_without_analysis() -> List[dict]:
    sql = """
        SELECT ri.* FROM regulatory_items ri
        LEFT JOIN ai_analysis a ON ri.id = a.item_id
        WHERE a.id IS NULL
        ORDER BY ri.detected_at DESC
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql).fetchall()]


# ── regulatory_tracking ───────────────────────────────────────────────────────

def upsert_tracking(tracking: dict) -> None:
    existing = get_tracking(tracking["item_id"])
    if existing:
        sql = """
            UPDATE regulatory_tracking SET
                applies = :applies, responsible_area = :responsible_area,
                owner = :owner, due_date = :due_date, impact_level = :impact_level,
                required_action = :required_action, action_plan = :action_plan,
                progress_status = :progress_status, comments = :comments,
                evidence_url = :evidence_url, last_update = :last_update
            WHERE item_id = :item_id
        """
    else:
        sql = """
            INSERT INTO regulatory_tracking
            (item_id, applies, responsible_area, owner, due_date, impact_level,
             required_action, action_plan, progress_status, comments, evidence_url, last_update)
            VALUES (:item_id, :applies, :responsible_area, :owner, :due_date,
                    :impact_level, :required_action, :action_plan, :progress_status,
                    :comments, :evidence_url, :last_update)
        """
    with get_connection() as conn:
        conn.execute(sql, tracking)


def get_tracking(item_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM regulatory_tracking WHERE item_id = ?", (item_id,)
        ).fetchone()
        return dict(row) if row else None


def get_all_tracking() -> List[dict]:
    sql = """
        SELECT t.*, ri.title, ri.country, ri.regulator, ri.document_type,
               ri.publication_date, ri.source_url, a.risk_score, a.risk_level,
               a.thematic_classification
        FROM regulatory_tracking t
        JOIN regulatory_items ri ON t.item_id = ri.id
        LEFT JOIN ai_analysis a ON ri.id = a.item_id
        ORDER BY t.last_update DESC
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql).fetchall()]


# ── dashboard stats ───────────────────────────────────────────────────────────

def get_dashboard_stats() -> dict:
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM regulatory_items").fetchone()[0]
        new = conn.execute(
            "SELECT COUNT(*) FROM regulatory_items WHERE status = 'nuevo'"
        ).fetchone()[0]
        applicable = conn.execute(
            "SELECT COUNT(*) FROM regulatory_items WHERE status IN ('aplica_informativo','aplica_requiere_accion')"
        ).fetchone()[0]
        critical = conn.execute(
            "SELECT COUNT(*) FROM ai_analysis WHERE risk_level = 'crítico'"
        ).fetchone()[0]
        expired = conn.execute(
            "SELECT COUNT(*) FROM regulatory_items WHERE status = 'vencido'"
        ).fetchone()[0]

        from datetime import datetime, timedelta
        soon = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        expiring_soon = conn.execute(
            "SELECT COUNT(*) FROM regulatory_tracking WHERE due_date <= ? AND progress_status NOT IN ('implementado','cerrado')",
            (soon,),
        ).fetchone()[0]

        by_country = conn.execute(
            "SELECT country, COUNT(*) as cnt FROM regulatory_items GROUP BY country"
        ).fetchall()
        by_regulator = conn.execute(
            "SELECT regulator, COUNT(*) as cnt FROM regulatory_items GROUP BY regulator ORDER BY cnt DESC LIMIT 10"
        ).fetchall()
        by_category = conn.execute(
            "SELECT thematic_classification, COUNT(*) as cnt FROM ai_analysis GROUP BY thematic_classification"
        ).fetchall()

    return {
        "total": total,
        "new": new,
        "applicable": applicable,
        "critical": critical,
        "expired": expired,
        "expiring_soon": expiring_soon,
        "by_country": [dict(r) for r in by_country],
        "by_regulator": [dict(r) for r in by_regulator],
        "by_category": [dict(r) for r in by_category],
    }
