from __future__ import annotations

from pathlib import Path
import json

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from config.settings import TRANSFORMED_DIR, UPLOAD_DIR
from services.calculations import MONTH_LABELS, dashboard_summary
from services.database import create_tables, test_connection
from services.excel_reader import ExcelReadError, list_sheets, read_excel_file, read_excel_preview
from services.repository import get_dashboard_data, get_existing_nomor_surat, get_filter_options, insert_valid_records, save_upload_batch, save_validation_errors
from services.transformer import transform_sanction_data
from services.validator import REQUIRED_COLUMNS, validate_structure, validate_transformed_data

GREEN = "#00B85A"
GREEN_LIGHT = "#00D26A"
PANEL = "#17352D"
TEXT = "#E8F3EF"
MUTED = "#91AAA1"
GRID = "rgba(145, 170, 161, 0.12)"
DONUT_COLORS = ["#006B35", "#007E3F", "#00984D", "#00AA55", "#35BB78", "#66CC98", "#A1E8C5", "#FFA5A0"]


def _safe_filter_options() -> tuple[dict[str, list], str | None]:
    try:
        create_tables()
        return get_filter_options(), None
    except Exception:
        ok, message = test_connection()
        if ok:
            return {"years": [], "departments": []}, "Tabel database belum dapat dibuat. Periksa privilege user database."
        return {"years": [], "departments": []}, message


@st.cache_data(ttl=20, show_spinner=False)
def _load_dashboard_data(
    year: int | None,
    month: int | None,
    department: str | None,
    sanction_type: str | None,
    status: str | None,
    position: str | None,
) -> pd.DataFrame:
    return get_dashboard_data(year=year, month=month, department=department, sanction_type=sanction_type, status=status, position=position)


def _save_uploaded_file(uploaded_file) -> Path:
    safe_name = Path(uploaded_file.name).name
    target = UPLOAD_DIR / safe_name
    target.write_bytes(uploaded_file.getbuffer())
    return target


def _persist_latest_upload(raw_df: pd.DataFrame, transformed_df: pd.DataFrame, raw_path: Path, file_name: str, sheet_name: str) -> None:
    TRANSFORMED_DIR.mkdir(parents=True, exist_ok=True)
    latest_transformed_path = TRANSFORMED_DIR / "latest_transformed.xlsx"
    latest_raw_path = TRANSFORMED_DIR / "latest_raw.xlsx"
    meta_path = TRANSFORMED_DIR / "latest_upload_meta.json"
    raw_df.to_excel(latest_raw_path, index=False)
    transformed_df.to_excel(latest_transformed_path, index=False)
    meta = {
        "file_name": file_name,
        "sheet_name": sheet_name,
        "raw_path": str(raw_path),
        "latest_raw_path": str(latest_raw_path),
        "latest_transformed_path": str(latest_transformed_path),
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def _append_local_dashboard_data(df: pd.DataFrame) -> None:
    if df.empty:
        return
    existing = st.session_state.get("dashboard_local_df")
    combined = df.copy() if existing is None else pd.concat([existing, df], ignore_index=True)
    if "nomor_surat_sanksi" in combined.columns:
        combined = combined.drop_duplicates("nomor_surat_sanksi", keep="last")
    st.session_state.dashboard_local_df = combined


def _load_latest_dashboard_from_disk() -> None:
    local_df = st.session_state.get("dashboard_local_df")
    if local_df is not None and not local_df.empty:
        return

    meta_path = TRANSFORMED_DIR / "latest_upload_meta.json"
    transformed_path = TRANSFORMED_DIR / "latest_transformed.xlsx"
    raw_path = TRANSFORMED_DIR / "latest_raw.xlsx"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            transformed_path = Path(meta.get("latest_transformed_path") or transformed_path)
            raw_path = Path(meta.get("latest_raw_path") or raw_path)
            st.session_state.uploaded_name = meta.get("file_name", st.session_state.get("uploaded_name"))
            st.session_state.selected_sheet = meta.get("sheet_name", st.session_state.get("selected_sheet"))
        except Exception:
            pass

    if not transformed_path.exists():
        return

    try:
        transformed_df = pd.read_excel(transformed_path)
        validation = validate_transformed_data(transformed_df)
        st.session_state.transformed_df = transformed_df
        st.session_state.valid_df = validation.valid_df
        st.session_state.invalid_df = validation.invalid_df
        st.session_state.errors_df = validation.errors_df
        st.session_state.duplicate_df = validation.duplicate_df
        st.session_state.dashboard_local_df = validation.valid_df.copy()
        if raw_path.exists() and st.session_state.get("raw_df") is None:
            raw_df = pd.read_excel(raw_path, dtype=str)
            st.session_state.raw_df = raw_df
            st.session_state.raw_edit_df = raw_df.copy()
            st.session_state.preview_df = raw_df.head(20)
            st.session_state.structure_result = validate_structure(raw_df)
    except Exception:
        return

def _apply_dashboard_filters(
    df: pd.DataFrame,
    year: int | None,
    month: int | None,
    department: str | None,
    sanction_type: str | None,
    status: str | None,
    position: str | None,
) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    filtered = df.copy()
    if year is not None and "tahun_sanksi" in filtered.columns:
        filtered = filtered[filtered["tahun_sanksi"].astype("Int64") == year]
    if month is not None and "bulan_sanksi" in filtered.columns:
        filtered = filtered[filtered["bulan_sanksi"].astype("Int64") == month]
    if department is not None and "departemen_seksi" in filtered.columns:
        filtered = filtered[filtered["departemen_seksi"] == department]
    if sanction_type is not None and "jenis_sanksi" in filtered.columns:
        filtered = filtered[filtered["jenis_sanksi"] == sanction_type]
    if status is not None and "status_sanksi" in filtered.columns:
        filtered = filtered[filtered["status_sanksi"] == status]
    if position is not None and "jabatan_karyawan" in filtered.columns:
        filtered = filtered[filtered["jabatan_karyawan"] == position]
    return filtered


def _extend_options_from_local(options: dict[str, list]) -> dict[str, list]:
    local_df = st.session_state.get("dashboard_local_df")
    if local_df is None or local_df.empty:
        return options
    merged = {key: list(value) for key, value in options.items()}
    if "tahun_sanksi" in local_df.columns:
        merged["years"] = sorted(set(merged.get("years", [])) | set(local_df["tahun_sanksi"].dropna().astype(int).tolist()))
    if "departemen_seksi" in local_df.columns:
        merged["departments"] = sorted(set(merged.get("departments", [])) | set(local_df["departemen_seksi"].dropna().astype(str).tolist()))
    if "jenis_sanksi" in local_df.columns:
        merged["sanction_types"] = sorted(set(merged.get("sanction_types", [])) | set(local_df["jenis_sanksi"].dropna().astype(str).tolist()))
    if "status_sanksi" in local_df.columns:
        merged["statuses"] = sorted(set(merged.get("statuses", [])) | set(local_df["status_sanksi"].dropna().astype(str).tolist()))
    if "jabatan_karyawan" in local_df.columns:
        merged["positions"] = sorted(set(merged.get("positions", [])) | set(local_df["jabatan_karyawan"].dropna().astype(str).tolist()))
    return merged


def _base_fig(height: int = 360) -> go.Figure:
    fig = go.Figure()
    fig.update_layout(
        height=height,
        margin=dict(l=58, r=24, t=42, b=64),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT, family="Inter, Arial, sans-serif", size=10),
        hoverlabel=dict(bgcolor="#08241D", bordercolor="#2D4B43", font_color=TEXT),
        showlegend=False,
        uniformtext=dict(minsize=9, mode="hide"),
    )
    fig.update_xaxes(
        gridcolor=GRID,
        zeroline=False,
        linecolor="rgba(0,0,0,0)",
        tickfont=dict(color=MUTED, size=9),
        title_font=dict(color=MUTED, size=11),
        automargin=True,
    )
    fig.update_yaxes(
        gridcolor=GRID,
        zeroline=False,
        linecolor="rgba(0,0,0,0)",
        tickfont=dict(color=MUTED, size=10),
        title_font=dict(color=MUTED, size=11),
        automargin=True,
    )
    return fig


def _trend_chart(data: pd.DataFrame) -> go.Figure:
    fig = _base_fig()
    fig.add_trace(
        go.Scatter(
            x=data["bulan"],
            y=data["jumlah"],
            mode="lines+markers+text",
            text=data["jumlah"],
            textposition="top center",
            textfont=dict(color=TEXT, size=10),
            cliponaxis=False,
            line=dict(color=GREEN_LIGHT, width=3, shape="spline", smoothing=1.2),
            marker=dict(color=GREEN_LIGHT, size=4, line=dict(color="#83FFC3", width=1)),
            fill="tozeroy",
            fillcolor="rgba(0,184,90,0.08)",
            hovertemplate="%{x}: %{y} sanksi<extra></extra>",
        )
    )
    max_y = max(5, int(data["jumlah"].max()) if not data.empty else 5)
    fig.update_xaxes(title_text="Bulan Sanksi")
    fig.update_yaxes(title_text="Jumlah Sanksi", range=[0, max_y + max(3, max_y * 0.15)])
    return fig


def _donut_chart(data: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    if not data.empty:
        colors = [DONUT_COLORS[i % len(DONUT_COLORS)] for i in range(len(data))]
        fig.add_trace(
            go.Pie(
                labels=data["jenis_sanksi"],
                values=data["jumlah"],
                hole=0.58,
                sort=False,
                marker=dict(colors=colors, line=dict(color=PANEL, width=0)),
                textinfo="value",
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                hovertemplate="%{label}: %{value}<extra></extra>",
            )
        )
    fig.update_layout(
        height=360,
        margin=dict(l=24, r=150, t=42, b=34),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT, family="Inter, Arial, sans-serif", size=10),
        showlegend=True,
        legend=dict(x=1.02, y=0.5, xanchor="left", yanchor="middle", font=dict(size=9, color=TEXT), itemwidth=30),
        hoverlabel=dict(bgcolor="#08241D", bordercolor="#2D4B43", font_color=TEXT),
    )
    return fig


def _department_chart(data: pd.DataFrame) -> go.Figure:
    fig = _base_fig()
    if not data.empty:
        fig.add_trace(
            go.Bar(
                x=data["departemen_seksi"],
                y=data["jumlah"],
                marker_color=GREEN,
                width=0.72,
                text=data["jumlah"],
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                cliponaxis=False,
                hovertemplate="%{x}: %{y} sanksi<extra></extra>",
            )
        )
    if not data.empty:
        max_y = max(1, int(data["jumlah"].max()))
        fig.update_yaxes(range=[0, max_y + max(1, max_y * 0.18)])
    fig.update_xaxes(title_text="Departemen/Seksi")
    fig.update_yaxes(title_text="Jumlah Sanksi")
    return fig


def _offender_chart(data: pd.DataFrame) -> go.Figure:
    fig = _base_fig(height=380)
    if not data.empty:
        ordered = data.sort_values("jumlah", ascending=True).copy()
        fig.add_trace(
            go.Bar(
                x=ordered["jumlah"],
                y=ordered["nama_karyawan"],
                orientation="h",
                customdata=ordered[["perner_karyawan", "jabatan", "departemen", "jenis_sanksi"]],
                marker_color=GREEN,
                text=ordered["jumlah"],
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                cliponaxis=False,
                hovertemplate=(
                    "%{y}<br>PERNER: %{customdata[0]}<br>Jabatan: %{customdata[1]}"
                    "<br>Departemen: %{customdata[2]}<br>Jenis Sanksi: %{customdata[3]}"
                    "<br>Jumlah surat unik: %{x}<extra></extra>"
                ),
            )
        )
        max_x = max(1, int(ordered["jumlah"].max()))
        fig.update_xaxes(range=[0, max_x + max(1, max_x * 0.24)])
    fig.update_layout(margin=dict(l=150, r=30, t=42, b=56))
    fig.update_xaxes(title_text="Jumlah Surat Sanksi")
    fig.update_yaxes(title_text="Nama Karyawan")
    return fig



def _yearly_chart(data: pd.DataFrame) -> go.Figure:
    fig = _base_fig()
    if not data.empty:
        fig.add_trace(
            go.Bar(
                x=data["tahun_sanksi"].astype(str),
                y=data["jumlah"],
                marker_color=GREEN,
                width=0.55,
                text=data["jumlah"],
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                cliponaxis=False,
                hovertemplate="Tahun %{x}: %{y} sanksi<extra></extra>",
            )
        )
    if not data.empty:
        max_y = max(1, int(data["jumlah"].max()))
        fig.update_yaxes(range=[0, max_y + max(1, max_y * 0.2)])
    fig.update_xaxes(title_text="Tahun Sanksi")
    fig.update_yaxes(title_text="Jumlah Sanksi")
    return fig


def _status_chart(data: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    if not data.empty:
        colors = ["#7DDFB2", GREEN_LIGHT, "#5B7D73"]
        fig.add_trace(
            go.Pie(
                labels=data["status_sanksi"],
                values=data["jumlah"],
                hole=0.58,
                marker=dict(colors=colors[: len(data)], line=dict(color=PANEL, width=0)),
                textinfo="label+value",
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                hovertemplate="%{label}: %{value}<extra></extra>",
            )
        )
    fig.update_layout(
        height=360,
        margin=dict(l=24, r=120, t=42, b=42),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT, family="Inter, Arial, sans-serif", size=10),
        showlegend=True,
        legend=dict(x=1.02, y=0.5, xanchor="left", yanchor="middle", font=dict(size=9, color=TEXT)),
        uniformtext=dict(minsize=9, mode="hide"),
    )
    return fig


def _violation_category_chart(data: pd.DataFrame) -> go.Figure:
    fig = _base_fig()
    if not data.empty:
        fig.add_trace(
            go.Bar(
                x=data["jumlah"],
                y=data["kategori_pelanggaran"],
                orientation="h",
                marker_color=GREEN,
                text=data["jumlah"],
                textposition="outside",
                textfont=dict(color=TEXT, size=10),
                cliponaxis=False,
                hovertemplate="%{y}: %{x} sanksi<extra></extra>",
            )
        )
    if not data.empty:
        max_x = max(1, int(data["jumlah"].max()))
        fig.update_xaxes(range=[0, max_x + max(1, max_x * 0.2)])
    fig.update_xaxes(title_text="Jumlah Sanksi")
    fig.update_yaxes(title_text="Kategori Pelanggaran")
    return fig

def _card(title: str, fig: go.Figure) -> None:
    st.markdown(f"<div class='chart-title'>{title}</div>", unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False, "displaylogo": False, "responsive": True})


def _load_to_database(path: str, file_name: str, sheet_name: str) -> tuple[bool, str]:
    raw_df = read_excel_file(path, sheet_name)
    structure = validate_structure(raw_df)
    if not structure.is_valid:
        return False, "Struktur Excel belum sesuai. Kolom hilang: " + ", ".join(structure.missing_columns)

    transformed = transform_sanction_data(raw_df)
    validation = validate_transformed_data(transformed)
    valid_df = validation.valid_df
    errors_df = validation.errors_df
    existing = get_existing_nomor_surat(valid_df["nomor_surat_sanksi"].dropna().astype(str).tolist()) if not valid_df.empty else set()

    batch_id = save_upload_batch(
        file_name=file_name,
        sheet_name=sheet_name,
        total_rows=len(transformed),
        valid_rows=len(valid_df),
        invalid_rows=len(validation.invalid_df),
        duplicate_rows=len(validation.duplicate_df) + len(existing),
        mode="ignore_duplicates",
    )
    inserted = insert_valid_records(valid_df, upload_batch_id=batch_id, mode="ignore_duplicates")
    save_validation_errors(errors_df, upload_batch_id=batch_id)
    st.session_state.last_uploaded_batch_id = batch_id
    st.session_state.active_batch_id = batch_id
    st.cache_data.clear()
    return True, f"{inserted} data valid berhasil dimuat. {len(validation.invalid_df)} data tidak valid tidak masuk dashboard."


def _render_upload_dialog(on_transform_click) -> None:
    @st.dialog("Upload Data Sanksi", width="large")
    def upload_dialog() -> None:
        uploaded_file = st.file_uploader("Pilih file Excel", type=["xlsx", "xls"], key="dashboard_dialog_uploader")
        if not uploaded_file:
            return

        upload_signature = f"{uploaded_file.name}:{uploaded_file.size}"
        if st.session_state.get("dialog_upload_signature") != upload_signature:
            st.session_state.dialog_upload_signature = upload_signature
            st.session_state.pop("dialog_transformed_df", None)
            st.session_state.pop("dialog_valid_count", None)
            st.session_state.pop("dialog_invalid_count", None)

        try:
            path = _save_uploaded_file(uploaded_file)
            sheet_names = list_sheets(path)
            sheet_name = st.selectbox("Sheet", sheet_names, key="dashboard_dialog_sheet")
            raw_df = read_excel_file(path, sheet_name)
            preview = raw_df.head(12)
            structure = validate_structure(raw_df)
        except ExcelReadError:
            return
        except Exception:
            return

        st.markdown(
            "<div class='dialog-meta'>" + f"{uploaded_file.name} | {uploaded_file.size / 1024:.1f} KB | {len(raw_df)} baris" + "</div>",
            unsafe_allow_html=True,
        )
        st.dataframe(preview, use_container_width=True, height=260, hide_index=True)

        if not structure.is_valid:
            st.markdown(
                "<div class='dialog-warning'>Kolom belum lengkap: " + ", ".join(structure.missing_columns) + "</div>",
                unsafe_allow_html=True,
            )

        transform_col, load_col = st.columns(2)
        with transform_col:
            if st.button("Transform", use_container_width=True):
                if not structure.is_valid:
                    return
                transformed = transform_sanction_data(raw_df)
                validation = validate_transformed_data(transformed)
                st.session_state.dialog_transformed_df = transformed
                st.session_state.dialog_valid_count = len(validation.valid_df)
                st.session_state.dialog_invalid_count = len(validation.invalid_df)
        with load_col:
            if st.button("Load", type="primary", use_container_width=True):
                if not structure.is_valid:
                    return
                transformed = transform_sanction_data(raw_df)
                validation = validate_transformed_data(transformed)
                _append_local_dashboard_data(validation.valid_df)
                _persist_latest_upload(raw_df, transformed, path, uploaded_file.name, sheet_name)
                st.session_state.uploaded_path = str(path)
                st.session_state.uploaded_name = uploaded_file.name
                st.session_state.sheet_names = sheet_names
                st.session_state.selected_sheet = sheet_name
                st.session_state.raw_df = raw_df
                st.session_state.raw_edit_df = raw_df.copy()
                st.session_state.preview_df = preview
                st.session_state.structure_result = structure
                st.session_state.transformed_df = transformed
                st.session_state.valid_df = validation.valid_df
                st.session_state.invalid_df = validation.invalid_df
                st.session_state.errors_df = validation.errors_df
                st.session_state.duplicate_df = validation.duplicate_df
                try:
                    _load_to_database(str(path), uploaded_file.name, sheet_name)
                except Exception:
                    pass
                st.cache_data.clear()
                st.session_state.show_upload_dialog = False
                st.session_state.pop("dialog_transformed_df", None)
                st.session_state.pop("dialog_valid_count", None)
                st.session_state.pop("dialog_invalid_count", None)
                st.rerun()

        transformed_df = st.session_state.get("dialog_transformed_df")
        if transformed_df is not None:
            st.markdown(
                "<div class='dialog-meta'>" + f"Hasil transform | valid: {st.session_state.get('dialog_valid_count', 0)} | tidak valid: {st.session_state.get('dialog_invalid_count', 0)}" + "</div>",
                unsafe_allow_html=True,
            )
            st.dataframe(transformed_df.head(12), use_container_width=True, height=220, hide_index=True)

    upload_dialog()

def render_dashboard(on_transform_click) -> None:
    _load_latest_dashboard_from_disk()
    options, db_error = _safe_filter_options()
    options = _extend_options_from_local(options)
    year_options = ["Tahun: Semua"] + [f"Tahun: {year}" for year in options["years"]]
    month_options = ["Bulan: Semua"] + [f"Bulan: {MONTH_LABELS[i]}" for i in range(1, 13)]
    department_options = ["Dep. : Semua"] + [f"Dep. : {department}" for department in options["departments"]]
    sanction_type_options = ["Jenis: Semua"] + [f"Jenis: {sanction_type}" for sanction_type in options.get("sanction_types", [])]
    position_options = ["Jabatan: Semua"] + [f"Jabatan: {position}" for position in options.get("positions", [])]
    status_options = ["Status: Semua"] + [f"Status: {status}" for status in options.get("statuses", [])]
    for key, choices in (
        ("filter_year", year_options),
        ("filter_month", month_options),
        ("filter_department", department_options),
        ("filter_sanction_type", sanction_type_options),
        ("filter_position", position_options),
        ("filter_status", status_options),
    ):
        if st.session_state.get(key) not in choices:
            st.session_state[key] = choices[0]

    filter_col, upload_col = st.columns([8.8, 0.85], vertical_alignment="center")
    with filter_col:
        st.markdown("<div class='filter-shell'><span class='filter-icon'></span><span class='filter-title'>FILTER:</span></div>", unsafe_allow_html=True)
        f0, f1, f2, f3, f4, f5, f6 = st.columns([0.55, 0.72, 0.78, 1.0, 0.92, 1.0, 0.9])    
        with f0:
            st.markdown("<span class='filter-spacer'></span>", unsafe_allow_html=True)
        with f1:
            year_selected = st.selectbox("Tahun", year_options, label_visibility="collapsed", key="filter_year")
        with f2:
            month_selected = st.selectbox("Bulan", month_options, label_visibility="collapsed", key="filter_month")
        with f3:
            department_selected = st.selectbox("Departemen", department_options, label_visibility="collapsed", key="filter_department")
        with f4:
            sanction_type_selected = st.selectbox("Jenis", sanction_type_options, label_visibility="collapsed", key="filter_sanction_type")
        with f5:
            position_selected = st.selectbox("Jabatan", position_options, label_visibility="collapsed", key="filter_position")
        with f6:
            status_selected = st.selectbox("Status", status_options, label_visibility="collapsed", key="filter_status")
    with upload_col:
        if st.button("Upload", type="primary", use_container_width=True, icon=":material/upload_file:"):
            st.session_state.show_upload_dialog = True

    if st.session_state.get("show_upload_dialog"):
        _render_upload_dialog(on_transform_click)

    local_df = st.session_state.get("dashboard_local_df")
    local_available = local_df is not None and not local_df.empty
    if db_error and not local_available:
        st.markdown(
            f"""
            <div class='empty-state'>
                <h3>Belum ada data sanksi</h3>
                <p>{db_error}</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    year = None if year_selected == "Tahun: Semua" else int(year_selected.replace("Tahun: ", ""))
    month = None if month_selected == "Bulan: Semua" else {f"Bulan: {label}": number for number, label in MONTH_LABELS.items()}[month_selected]
    department = None if department_selected == "Dep. : Semua" else department_selected.replace("Dep. : ", "", 1)
    sanction_type = None if sanction_type_selected == "Jenis: Semua" else sanction_type_selected.replace("Jenis: ", "", 1)
    position = None if position_selected == "Jabatan: Semua" else position_selected.replace("Jabatan: ", "", 1)
    status = None if status_selected == "Status: Semua" else status_selected.replace("Status: ", "", 1)

    try:
        records = pd.DataFrame() if db_error else _load_dashboard_data(year, month, department, sanction_type, status, position)
    except Exception:
        records = pd.DataFrame()

    local_filtered = _apply_dashboard_filters(local_df, year, month, department, sanction_type, status, position)
    if not local_filtered.empty:
        records = pd.concat([records, local_filtered], ignore_index=True) if not records.empty else local_filtered.copy()
        if "nomor_surat_sanksi" in records.columns:
            records = records.drop_duplicates("nomor_surat_sanksi", keep="last")

    if records.empty:
        st.markdown(
            """
            <div class='empty-state compact'>
                <h3>Belum ada data sanksi</h3>
                <p>Klik Upload untuk memuat Excel dan memperbarui dashboard.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    summary = dashboard_summary(records)
    st.markdown(
        f"""
        <div class='kpi-card-row'>
            <div class='kpi-card'><small>Total Surat Sanksi</small><b>{summary['total_sanksi']}</b></div>
            <div class='kpi-card'><small>Karyawan Terkena</small><b>{summary['total_karyawan']}</b></div>
            <div class='kpi-card'><small>Sanksi Aktif</small><b>{summary['total_aktif']}</b></div>
            <div class='kpi-card'><small>Pelanggar Berulang</small><b>{summary['total_pelanggar_berulang']}</b></div>
            <div class='kpi-card'><small>Rata-rata Durasi</small><b>{summary['rata_durasi']:.1f}<em>hari</em></b></div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    row1_left, row1_right = st.columns([1.15, 0.85])
    with row1_left:
        _card("Tren Sanksi Bulanan", _trend_chart(summary["bulanan"]))
    with row1_right:
        _card("Komposisi Jenis Sanksi", _donut_chart(summary["jenis"]))

    row2_left, row2_right = st.columns([1.05, 0.95])
    with row2_left:
        _card("Sanksi Berdasarkan Departemen", _department_chart(summary["departemen"]))
    with row2_right:
        _card("Top Pelanggar Berulang", _offender_chart(summary["pelanggar_berulang"]))

    row3_left, row3_mid, row3_right = st.columns([1, 1, 1])
    with row3_left:
        _card("Tren Sanksi Tahunan", _yearly_chart(summary["tahunan"]))
    with row3_mid:
        _card("Status Sanksi", _status_chart(summary["status"]))
    with row3_right:
        _card("Kategori Pelanggaran", _violation_category_chart(summary["kategori_pelanggaran"]))





