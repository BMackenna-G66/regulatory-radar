"""Radar Regulatorio – Streamlit MVP"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure src is importable
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import plotly.express as px
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

from src import database as db
from src.alerts import check_and_fire_alerts
from src.exports import export_bitacora
from src.models import RegulatoryTracking
from src.utils import setup_logging

logger = setup_logging("app")

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Radar Regulatorio",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Init DB on first run ──────────────────────────────────────────────────────
db.init_db()

# ── Custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    .metric-card {
        background: #f0f2f6;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
        border-left: 5px solid #1F4E79;
    }
    .risk-critico  { color: #c00000; font-weight: bold; }
    .risk-alto     { color: #e07000; font-weight: bold; }
    .risk-medio    { color: #b8860b; }
    .risk-bajo     { color: #2e7d32; }
    .status-badge  { padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
</style>
""", unsafe_allow_html=True)

_RISK_COLORS = {"crítico": "🔴", "alto": "🟠", "medio": "🟡", "bajo": "🟢"}
_STATUS_ES = {
    "nuevo": "Nuevo",
    "en_revision": "En revisión",
    "no_aplica": "No aplica",
    "aplica_informativo": "Aplica (info)",
    "aplica_requiere_accion": "Aplica (acción)",
    "implementado": "Implementado",
    "vencido": "Vencido",
}
_PROGRESS_ES = {
    "pendiente_revision": "⏳ Pendiente",
    "asignado": "👤 Asignado",
    "en_implementacion": "🔧 En implementación",
    "bloqueado": "🚫 Bloqueado",
    "implementado": "✅ Implementado",
    "cerrado": "🔒 Cerrado",
}


# ── Sidebar navigation ────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/color/96/radar.png", width=60)
    st.title("Radar Regulatorio")
    st.markdown("---")
    page = st.radio(
        "Navegación",
        ["📊 Dashboard", "📥 Bandeja de revisión", "🔍 Detalle normativa",
         "📋 Seguimiento", "📤 Exportar", "⚙️ Configuración"],
        label_visibility="collapsed",
    )
    st.markdown("---")
    if st.button("🔔 Revisar alertas"):
        with st.spinner("Verificando alertas…"):
            alerts = check_and_fire_alerts()
        if alerts:
            for a in alerts[:5]:
                st.warning(f"{a['icon']} {a['message'][:80]}")
        else:
            st.success("Sin alertas activas")


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
if page == "📊 Dashboard":
    st.title("📊 Dashboard Ejecutivo")

    stats = db.get_dashboard_stats()

    # KPI row
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Total detectadas", stats["total"])
    c2.metric("🆕 Nuevas", stats["new"])
    c3.metric("✅ Aplicables", stats["applicable"])
    c4.metric("🔴 Críticas", stats["critical"])
    c5.metric("💀 Vencidas", stats["expired"])
    c6.metric("⏰ Por vencer (7d)", stats["expiring_soon"])

    st.markdown("---")

    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Distribución por País")
        if stats["by_country"]:
            df_country = pd.DataFrame(stats["by_country"])
            fig = px.pie(df_country, names="country", values="cnt",
                         color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_traces(textposition="inside", textinfo="percent+label")
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Sin datos aún")

    with col_right:
        st.subheader("Top Reguladores")
        if stats["by_regulator"]:
            df_reg = pd.DataFrame(stats["by_regulator"])
            fig = px.bar(df_reg, x="cnt", y="regulator", orientation="h",
                         color="cnt", color_continuous_scale="Blues",
                         labels={"cnt": "Normas", "regulator": ""})
            fig.update_layout(yaxis=dict(autorange="reversed"), showlegend=False)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Sin datos aún")

    st.subheader("Distribución por Categoría")
    if stats["by_category"]:
        df_cat = pd.DataFrame(stats["by_category"]).dropna()
        df_cat = df_cat[df_cat["thematic_classification"].notna()]
        if not df_cat.empty:
            fig = px.bar(df_cat, x="thematic_classification", y="cnt",
                         color="cnt", color_continuous_scale="Viridis",
                         labels={"cnt": "Normas", "thematic_classification": "Categoría"})
            st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Ejecuta el análisis IA para ver categorías")


# ══════════════════════════════════════════════════════════════════════════════
# BANDEJA DE REVISIÓN
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📥 Bandeja de revisión":
    st.title("📥 Bandeja de Revisión")

    col_f1, col_f2, col_f3, col_f4 = st.columns(4)
    with col_f1:
        f_country = st.selectbox("País", ["Todos", "Chile", "Colombia"])
    with col_f2:
        f_status = st.selectbox("Estado", ["Todos"] + list(_STATUS_ES.keys()))
    with col_f3:
        f_risk = st.selectbox("Riesgo", ["Todos", "crítico", "alto", "medio", "bajo"])
    with col_f4:
        search_term = st.text_input("🔍 Buscar", placeholder="Título…")

    filters = {}
    if f_country != "Todos":
        filters["country"] = f_country
    if f_status != "Todos":
        filters["status"] = f_status

    items = db.get_all_items(filters)

    if f_risk != "Todos":
        items = [i for i in items if i.get("risk_level") == f_risk]
    if search_term:
        items = [i for i in items if search_term.lower() in i.get("title", "").lower()]

    st.caption(f"Mostrando {len(items)} normas")

    if not items:
        st.info("No hay normas que coincidan con los filtros. Ejecuta el scraping desde ⚙️ Configuración.")
    else:
        for item in items:
            risk_icon = _RISK_COLORS.get(item.get("risk_level", ""), "⚪")
            score = item.get("risk_score", "—")
            with st.expander(
                f"{risk_icon} [{item['country']}] {item.get('document_type','Doc')} | "
                f"Score: {score} | {item['title'][:90]}"
            ):
                c1, c2, c3, c4 = st.columns(4)
                c1.write(f"**Fecha:** {item.get('publication_date','—')}")
                c2.write(f"**Regulador:** {item['regulator']}")
                c3.write(f"**Estado:** {_STATUS_ES.get(item['status'], item['status'])}")
                c4.write(f"**Categoría:** {item.get('thematic_classification','—')}")

                col_btn1, col_btn2 = st.columns([1, 5])
                with col_btn1:
                    if st.button("Ver detalle →", key=f"detail_{item['id']}"):
                        st.session_state["selected_item_id"] = item["id"]
                        st.session_state["nav_page"] = "🔍 Detalle normativa"
                        st.rerun()
                with col_btn2:
                    new_status = st.selectbox(
                        "Cambiar estado",
                        list(_STATUS_ES.keys()),
                        index=list(_STATUS_ES.keys()).index(item["status"]) if item["status"] in _STATUS_ES else 0,
                        key=f"status_{item['id']}",
                    )
                    if new_status != item["status"]:
                        if st.button("Guardar estado", key=f"save_status_{item['id']}"):
                            db.update_item_status(item["id"], new_status)
                            st.success("Estado actualizado")
                            st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# DETALLE NORMATIVA
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🔍 Detalle normativa":
    st.title("🔍 Detalle de Normativa")

    # Item selector
    all_items = db.get_all_items()
    if not all_items:
        st.warning("No hay normas cargadas. Ve a ⚙️ Configuración y ejecuta el scraping.")
        st.stop()

    item_options = {f"[{i['country']}] {i['title'][:80]}": i["id"] for i in all_items}
    default_idx = 0
    if "selected_item_id" in st.session_state:
        sel_id = st.session_state["selected_item_id"]
        ids = list(item_options.values())
        if sel_id in ids:
            default_idx = ids.index(sel_id)

    selected_label = st.selectbox("Seleccionar normativa", list(item_options.keys()), index=default_idx)
    item_id = item_options[selected_label]

    item = db.get_regulatory_item(item_id)
    analysis = db.get_ai_analysis(item_id)
    tracking = db.get_tracking(item_id)

    if not item:
        st.error("Normativa no encontrada")
        st.stop()

    # Header
    risk_icon = _RISK_COLORS.get(analysis.get("risk_level") if analysis else "", "⚪")
    st.subheader(f"{risk_icon} {item['title']}")

    tab1, tab2, tab3 = st.tabs(["📑 Análisis IA", "📄 Texto original", "✏️ Seguimiento"])

    with tab1:
        if not analysis:
            st.info("Este documento aún no tiene análisis IA.")
            if st.button("🤖 Analizar con IA ahora"):
                with st.spinner("Analizando con Claude…"):
                    from src.ai.analyzer import analyze_item
                    from src import database as db2
                    result = analyze_item(item)
                    db2.upsert_ai_analysis(result)
                st.success("Análisis completado")
                st.rerun()
        else:
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Risk Score", analysis["risk_score"])
            c2.metric("Nivel", analysis["risk_level"].upper())
            c3.metric("¿Aplica?", analysis["applies"])
            c4.metric("Criticidad", analysis["criticality"])

            st.markdown("---")

            col_l, col_r = st.columns(2)
            with col_l:
                st.markdown("**📋 Resumen ejecutivo**")
                st.info(analysis.get("executive_summary", "—"))

                st.markdown("**🔄 Principales cambios**")
                st.write(analysis.get("main_changes", "—"))

                st.markdown("**💥 Posible impacto**")
                st.write(analysis.get("possible_impact", "—"))

                st.markdown("**📌 Obligaciones detectadas**")
                st.warning(analysis.get("detected_obligations", "—"))

            with col_r:
                st.markdown("**🏢 Áreas afectadas**")
                st.write(analysis.get("affected_areas", "—"))

                st.markdown("**📦 Productos / procesos**")
                st.write(analysis.get("affected_products", "—"))

                st.markdown("**🗓️ Fecha máxima de aplicación**")
                st.write(analysis.get("max_application_date") or "No especificada")

                st.markdown("**🏷️ Clasificación temática**")
                st.write(analysis.get("thematic_classification", "—"))

                st.markdown("**💡 Acción recomendada**")
                st.success(analysis.get("recommended_action", "—"))

            if st.button("🔄 Re-procesar análisis IA"):
                with st.spinner("Re-analizando…"):
                    from src.ai.analyzer import analyze_item
                    result = analyze_item(item)
                    db.upsert_ai_analysis(result)
                st.success("Re-análisis completado")
                st.rerun()

    with tab2:
        st.markdown(f"**Fuente:** [{item['source_url']}]({item['source_url']})")
        st.markdown(f"**Regulador:** {item['regulator']} | **País:** {item['country']} | **Tipo:** {item.get('document_type','—')}")
        st.markdown(f"**Publicado:** {item.get('publication_date','—')} | **Detectado:** {item['detected_at'][:10]}")
        st.markdown("---")
        raw = item.get("raw_text", "") or "Texto no disponible. Revisar fuente directamente."
        st.text_area("Texto original", value=raw, height=300, disabled=True)

    with tab3:
        st.subheader("✏️ Registrar seguimiento")

        current = tracking or {}
        ai_sug = analysis or {}

        with st.form(f"tracking_form_{item_id}"):
            col1, col2 = st.columns(2)
            with col1:
                applies = st.selectbox(
                    "¿Aplica?", ["sí", "no", "revisar"],
                    index=["sí","no","revisar"].index(current.get("applies", ai_sug.get("applies","revisar")))
                    if current.get("applies", ai_sug.get("applies","revisar")) in ["sí","no","revisar"] else 2,
                )
                responsible_area = st.selectbox(
                    "Área responsable",
                    RegulatoryTracking.RESPONSIBLE_AREAS,
                    index=RegulatoryTracking.RESPONSIBLE_AREAS.index(current.get("responsible_area", ai_sug.get("suggested_area","Compliance")))
                    if current.get("responsible_area", ai_sug.get("suggested_area","Compliance")) in RegulatoryTracking.RESPONSIBLE_AREAS else 0,
                )
                owner = st.text_input("Encargado", value=current.get("owner", ""))
            with col2:
                due_date = st.date_input(
                    "Fecha límite",
                    value=datetime.strptime(current["due_date"], "%Y-%m-%d").date()
                    if current.get("due_date") else datetime.now().date() + timedelta(days=30),
                )
                impact_level = st.selectbox(
                    "Nivel de impacto",
                    ["bajo", "medio", "alto", "crítico"],
                    index=["bajo","medio","alto","crítico"].index(current.get("impact_level", ai_sug.get("criticality","medio")))
                    if current.get("impact_level", ai_sug.get("criticality","medio")) in ["bajo","medio","alto","crítico"] else 1,
                )
                progress_status = st.selectbox(
                    "Estado de avance",
                    RegulatoryTracking.PROGRESS_STATUSES,
                    format_func=lambda s: _PROGRESS_ES.get(s, s),
                    index=RegulatoryTracking.PROGRESS_STATUSES.index(current.get("progress_status","pendiente_revision"))
                    if current.get("progress_status","pendiente_revision") in RegulatoryTracking.PROGRESS_STATUSES else 0,
                )

            required_action = st.text_area(
                "Acción requerida",
                value=current.get("required_action", ai_sug.get("recommended_action", "")),
                height=80,
            )
            action_plan = st.text_area(
                "Plan de acción",
                value=current.get("action_plan", ""),
                height=100,
            )
            comments = st.text_area("Comentarios", value=current.get("comments", ""), height=80)
            evidence_url = st.text_input("URL evidencia", value=current.get("evidence_url", ""))

            submitted = st.form_submit_button("💾 Guardar seguimiento", type="primary")
            if submitted:
                record = {
                    "item_id": item_id,
                    "applies": applies,
                    "responsible_area": responsible_area,
                    "owner": owner,
                    "due_date": due_date.strftime("%Y-%m-%d"),
                    "impact_level": impact_level,
                    "required_action": required_action,
                    "action_plan": action_plan,
                    "progress_status": progress_status,
                    "comments": comments,
                    "evidence_url": evidence_url,
                    "last_update": datetime.now().isoformat(),
                }
                db.upsert_tracking(record)
                # Sync item status
                status_map = {
                    "pendiente_revision": "en_revision",
                    "asignado": "aplica_requiere_accion",
                    "en_implementacion": "aplica_requiere_accion",
                    "bloqueado": "aplica_requiere_accion",
                    "implementado": "implementado",
                    "cerrado": "implementado",
                }
                new_status = status_map.get(progress_status, item["status"])
                if applies == "no":
                    new_status = "no_aplica"
                elif applies == "sí" and progress_status == "pendiente_revision":
                    new_status = "aplica_requiere_accion"
                db.update_item_status(item_id, new_status)
                st.success("✅ Seguimiento guardado")
                st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# SEGUIMIENTO (Kanban / tabla)
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📋 Seguimiento":
    st.title("📋 Seguimiento Regulatorio")

    view_mode = st.radio("Vista", ["Kanban", "Tabla"], horizontal=True)
    tracking_rows = db.get_all_tracking()

    if not tracking_rows:
        st.info("No hay normas con seguimiento registrado. Ve a la vista de Detalle y registra el seguimiento.")
    elif view_mode == "Kanban":
        statuses = RegulatoryTracking.PROGRESS_STATUSES
        cols = st.columns(len(statuses))
        for col, status in zip(cols, statuses):
            with col:
                st.markdown(f"**{_PROGRESS_ES.get(status, status)}**")
                group = [r for r in tracking_rows if r.get("progress_status") == status]
                st.caption(f"{len(group)} norma(s)")
                for row in group:
                    risk_icon = _RISK_COLORS.get(row.get("risk_level",""), "⚪")
                    with st.container(border=True):
                        st.markdown(f"**{risk_icon} {row['title'][:50]}…**")
                        st.caption(f"📍 {row.get('responsible_area','—')} | 👤 {row.get('owner','—')}")
                        if row.get("due_date"):
                            due = row["due_date"]
                            today = datetime.now().strftime("%Y-%m-%d")
                            color = "🔴" if due < today else ("🟡" if due <= (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d") else "🟢")
                            st.caption(f"{color} Due: {due}")
    else:
        df = pd.DataFrame(tracking_rows)
        cols_show = ["title", "country", "responsible_area", "owner", "due_date", "impact_level", "progress_status", "risk_score"]
        cols_show = [c for c in cols_show if c in df.columns]
        if not df.empty:
            df_display = df[cols_show].rename(columns={
                "title": "Normativa", "country": "País",
                "responsible_area": "Área", "owner": "Encargado",
                "due_date": "Fecha límite", "impact_level": "Impacto",
                "progress_status": "Estado", "risk_score": "Score",
            })
            df_display["Estado"] = df_display["Estado"].map(_PROGRESS_ES).fillna(df_display["Estado"])
            st.dataframe(df_display, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════════════════════════════════════
# EXPORTAR
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📤 Exportar":
    st.title("📤 Exportar Bitácora")
    st.markdown("Genera la **Bitácora de Monitoreo Regulatorio** en formato Excel con todas las normas y su seguimiento.")

    col1, col2 = st.columns(2)
    with col1:
        f_country = st.selectbox("Filtrar por país", ["Todos", "Chile", "Colombia"])
    with col2:
        f_status = st.selectbox("Filtrar por estado", ["Todos"] + list(_STATUS_ES.keys()))

    filters = {}
    if f_country != "Todos":
        filters["country"] = f_country
    if f_status != "Todos":
        filters["status"] = f_status

    items_preview = db.get_all_items(filters)
    st.info(f"Se exportarán **{len(items_preview)}** normas.")

    if st.button("📥 Generar Excel", type="primary"):
        with st.spinner("Generando archivo…"):
            excel_bytes = export_bitacora(filters)
        filename = f"Bitacora_Regulatoria_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
        st.download_button(
            label="⬇️ Descargar Bitácora Excel",
            data=excel_bytes,
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN / SCRAPING
# ══════════════════════════════════════════════════════════════════════════════
elif page == "⚙️ Configuración":
    st.title("⚙️ Configuración y Scraping Manual")

    tab_scraping, tab_ai, tab_env = st.tabs(["🕷️ Scraping", "🤖 Análisis IA", "🔧 Entorno"])

    with tab_scraping:
        st.subheader("Ejecutar scraping manual")

        import yaml
        config_path = Path(__file__).parent / "config" / "sources.yaml"
        with open(config_path) as f:
            config = yaml.safe_load(f)
        sources = config.get("sources", [])
        scraping_cfg = config.get("scraping", {})

        enabled_sources = [s for s in sources if s.get("enabled", True)]
        st.markdown(f"**{len(enabled_sources)} fuentes activas configuradas**")

        source_options = {s["name"]: s for s in enabled_sources}
        selected_sources = st.multiselect(
            "Seleccionar fuentes",
            list(source_options.keys()),
            default=list(source_options.keys()),
        )

        if st.button("▶️ Ejecutar scraping ahora", type="primary"):
            from src.scrapers.cmf_scraper import CMFScraper
            from src.scrapers.banco_central_scraper import BancoCentralScraper
            from src.scrapers.diario_oficial_scraper import DiarioOficialScraper
            from src.scrapers.sfc_scraper import SFCScraper
            from src.scrapers.generic_scraper import GenericScraper

            scraper_map = {
                "cmf": CMFScraper,
                "banco_central": BancoCentralScraper,
                "diario_oficial": DiarioOficialScraper,
                "sfc": SFCScraper,
                "generic": GenericScraper,
            }

            total_saved = 0
            progress_bar = st.progress(0)
            status_text = st.empty()

            selected_cfgs = [s for s in enabled_sources if s["name"] in selected_sources]
            for idx, src_cfg in enumerate(selected_cfgs):
                status_text.text(f"Scraping: {src_cfg['name']}…")
                scraper_type = src_cfg.get("scraper", "generic")
                ScraperClass = scraper_map.get(scraper_type, GenericScraper)
                try:
                    if scraper_type == "generic":
                        scraper = ScraperClass(src_cfg, scraping_cfg)
                    else:
                        scraper = ScraperClass(scraping_cfg)
                    saved = scraper.run()
                    total_saved += saved
                    st.write(f"✅ {src_cfg['name']}: {saved} normas nuevas")
                except Exception as e:
                    st.error(f"❌ {src_cfg['name']}: {e}")
                progress_bar.progress((idx + 1) / len(selected_cfgs))

            status_text.text("Scraping completado")
            st.success(f"✅ Total: {total_saved} nuevas normas guardadas")

    with tab_ai:
        st.subheader("Análisis IA masivo")
        pending = db.get_items_without_analysis()
        st.info(f"**{len(pending)}** normas sin analizar")

        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key or api_key == "your_anthropic_api_key_here":
            st.warning("⚠️ No se encontró ANTHROPIC_API_KEY. Se usará el motor de reglas como fallback.")

        if pending:
            batch_size = st.slider("Procesar hasta N normas", 1, min(50, len(pending)), min(10, len(pending)))
            if st.button("🤖 Analizar con IA", type="primary"):
                from src.ai.analyzer import batch_analyze
                items_to_analyze = pending[:batch_size]
                progress_bar = st.progress(0)
                for idx, item in enumerate(items_to_analyze):
                    from src.ai.analyzer import analyze_item
                    try:
                        result = analyze_item(item)
                        db.upsert_ai_analysis(result)
                    except Exception as e:
                        st.error(f"Error en item {item['id']}: {e}")
                    progress_bar.progress((idx + 1) / len(items_to_analyze))
                st.success(f"✅ {len(items_to_analyze)} normas analizadas")
                st.rerun()

    with tab_env:
        st.subheader("Variables de entorno")
        st.code("""
# Copiar .env.example a .env y completar:
ANTHROPIC_API_KEY=sk-ant-...
DB_PATH=data/regulatory_radar.db
LOG_LEVEL=INFO
SLACK_WEBHOOK_URL=    # opcional
        """)
        st.markdown(f"**DB path actual:** `{db.get_db_path()}`")
        st.markdown(f"**API Key configurada:** {'✅' if (os.getenv('ANTHROPIC_API_KEY','') not in ('','your_anthropic_api_key_here')) else '❌ No configurada'}")

        st.markdown("---")
        st.subheader("Datos de prueba")
        if st.button("📦 Cargar datos de prueba"):
            _load_sample_data()
            st.success("Datos de prueba cargados")
            st.rerun()


def _load_sample_data():
    """Load sample regulatory items for demo/testing."""
    from src.scrapers.cmf_scraper import CMFScraper
    from src.scrapers.banco_central_scraper import BancoCentralScraper
    from src.scrapers.sfc_scraper import SFCScraper
    from src.scrapers.diario_oficial_scraper import DiarioOficialScraper

    for ScraperClass in [CMFScraper, BancoCentralScraper, SFCScraper, DiarioOficialScraper]:
        try:
            scraper = ScraperClass()
            items = scraper.fetch_items()
            for item in items:
                if not db.hash_exists(item["content_hash"]):
                    db.insert_regulatory_item(item)
        except Exception:
            pass
