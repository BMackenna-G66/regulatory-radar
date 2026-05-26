from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class RegulatoryItem:
    country: str
    regulator: str
    document_type: str
    title: str
    publication_date: Optional[str]
    source_url: str
    raw_text: str
    content_hash: str
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())
    status: str = "nuevo"
    id: Optional[int] = None

    STATUSES = [
        "nuevo",
        "en_revision",
        "no_aplica",
        "aplica_informativo",
        "aplica_requiere_accion",
        "implementado",
        "vencido",
    ]


@dataclass
class AIAnalysis:
    item_id: int
    executive_summary: str
    main_changes: str
    possible_impact: str
    affected_areas: str
    affected_products: str
    detected_obligations: str
    max_application_date: Optional[str]
    thematic_classification: str
    risk_score: int
    risk_level: str
    applies: str
    applies_reason: str
    suggested_area: str
    criticality: str
    recommended_action: str
    analyzed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    id: Optional[int] = None

    CATEGORIES = [
        "AML",
        "KYC",
        "Fraude",
        "Sanciones",
        "PEP",
        "Protección al consumidor",
        "Datos personales",
        "Criptoactivos",
        "Tributario",
        "Operacional",
        "Otros",
    ]

    APPLIES_OPTIONS = ["sí", "no", "revisar"]

    CRITICALITY_LEVELS = ["bajo", "medio", "alto", "crítico"]


@dataclass
class RegulatoryTracking:
    item_id: int
    applies: str
    responsible_area: str
    owner: str
    due_date: Optional[str]
    impact_level: str
    required_action: str
    action_plan: str
    progress_status: str = "pendiente_revision"
    comments: str = ""
    evidence_url: str = ""
    last_update: str = field(default_factory=lambda: datetime.now().isoformat())
    id: Optional[int] = None

    PROGRESS_STATUSES = [
        "pendiente_revision",
        "asignado",
        "en_implementacion",
        "bloqueado",
        "implementado",
        "cerrado",
    ]

    RESPONSIBLE_AREAS = [
        "Compliance",
        "Legal",
        "Fraude",
        "Operaciones",
        "Producto",
        "Finanzas",
        "Tecnología",
        "Data",
        "CX",
    ]
