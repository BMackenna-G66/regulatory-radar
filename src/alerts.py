"""Alert engine – console now, Slack/email hooks ready."""

import os
from datetime import datetime, timedelta
from typing import List

import requests

from src import database as db
from src.utils import setup_logging

logger = setup_logging("alerts")


def check_and_fire_alerts() -> List[dict]:
    alerts = []
    alerts.extend(_critical_new_items())
    alerts.extend(_applicable_without_owner())
    alerts.extend(_overdue_actions())
    alerts.extend(_expiring_soon())

    for alert in alerts:
        _dispatch(alert)

    return alerts


def _critical_new_items() -> List[dict]:
    alerts = []
    items = db.get_all_items({"status": "nuevo"})
    for item in items:
        if item.get("risk_level") == "crítico":
            alerts.append({
                "type": "CRÍTICO",
                "icon": "🚨",
                "message": f"Nueva norma CRÍTICA detectada: [{item['country']}] {item['title'][:80]}",
                "item_id": item["id"],
            })
    return alerts


def _applicable_without_owner() -> List[dict]:
    alerts = []
    tracking_rows = db.get_all_tracking()
    for row in tracking_rows:
        if row.get("applies") == "sí" and not row.get("owner"):
            alerts.append({
                "type": "SIN_RESPONSABLE",
                "icon": "⚠️",
                "message": f"Norma aplicable sin responsable asignado: {row['title'][:80]}",
                "item_id": row["item_id"],
            })
    return alerts


def _overdue_actions() -> List[dict]:
    alerts = []
    today = datetime.now().strftime("%Y-%m-%d")
    tracking_rows = db.get_all_tracking()
    for row in tracking_rows:
        due = row.get("due_date")
        status = row.get("progress_status", "")
        if due and due < today and status not in ("implementado", "cerrado"):
            alerts.append({
                "type": "VENCIDO",
                "icon": "🔴",
                "message": f"Acción VENCIDA (due: {due}): {row['title'][:80]}",
                "item_id": row["item_id"],
            })
    return alerts


def _expiring_soon() -> List[dict]:
    alerts = []
    threshold = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")
    tracking_rows = db.get_all_tracking()
    for row in tracking_rows:
        due = row.get("due_date")
        status = row.get("progress_status", "")
        if due and today <= due <= threshold and status not in ("implementado", "cerrado"):
            days_left = (datetime.strptime(due, "%Y-%m-%d") - datetime.now()).days
            alerts.append({
                "type": "POR_VENCER",
                "icon": "⏰",
                "message": f"Acción vence en {days_left}d (due: {due}): {row['title'][:80]}",
                "item_id": row["item_id"],
            })
    return alerts


def _dispatch(alert: dict) -> None:
    icon = alert.get("icon", "ℹ️")
    msg = alert["message"]
    logger.warning("[ALERTA %s] %s %s", alert["type"], icon, msg)

    # Slack webhook (optional)
    webhook = os.getenv("SLACK_WEBHOOK_URL", "")
    if webhook:
        try:
            requests.post(webhook, json={"text": f"{icon} *[{alert['type']}]* {msg}"}, timeout=5)
        except Exception as e:
            logger.error("Slack notification failed: %s", e)
