from __future__ import annotations

from datetime import datetime
from html import escape
from pathlib import Path
import base64
import json
import mimetypes
import uuid

import pandas as pd
import streamlit as st

from config.settings import ARCHIVE_DIR


METADATA_PATH = ARCHIVE_DIR / "metadata.json"
ALLOWED_EXTENSIONS = [
    "pdf",
    "xlsx",
    "xls",
    "csv",
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "txt",
    "md",
    "json",
    "xml",
    "html",
    "zip",
    "rar",
    "7z",
    "mp4",
    "mov",
    "mp3",
]
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
TABLE_EXTENSIONS = {"xlsx", "xls", "csv"}
PDF_EXTENSIONS = {"pdf"}


FILE_ICONS = {
    "pdf": "PDF",
    "xlsx": "XLS",
    "xls": "XLS",
    "csv": "CSV",
    "png": "IMG",
    "jpg": "IMG",
    "jpeg": "IMG",
    "gif": "IMG",
    "webp": "IMG",
    "doc": "DOC",
    "docx": "DOC",
    "ppt": "PPT",
    "pptx": "PPT",
    "txt": "TXT",
    "md": "TXT",
    "json": "JSON",
    "xml": "XML",
    "html": "HTML",
    "zip": "ZIP",
    "rar": "RAR",
    "7z": "7Z",
    "mp4": "VID",
    "mov": "VID",
    "mp3": "AUD",
}


def _load_metadata() -> list[dict[str, object]]:
    if not METADATA_PATH.exists():
        return []
    try:
        data = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def _save_metadata(records: list[dict[str, object]]) -> None:
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def _format_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{value:.1f} GB"


def _file_extension(file_name: str) -> str:
    return Path(file_name).suffix.lower().lstrip(".") or "file"


def _file_icon(extension: str) -> str:
    return FILE_ICONS.get(extension, "FILE")


def _upload_time_label(uploaded_at: str) -> str:
    try:
        dt = datetime.fromisoformat(uploaded_at)
        return dt.strftime("%d %b %Y, %H:%M")
    except Exception:
        return uploaded_at


def _record_year(record: dict[str, object]) -> int | None:
    try:
        return datetime.fromisoformat(str(record.get("uploaded_at", ""))).year
    except Exception:
        return None


def _save_archive(title: str, uploaded_file) -> None:
    now = datetime.now()
    original_name = Path(uploaded_file.name).name
    extension = _file_extension(original_name)
    stored_name = f"{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{extension}"
    stored_path = ARCHIVE_DIR / stored_name
    stored_path.write_bytes(uploaded_file.getbuffer())

    records = _load_metadata()
    records.insert(
        0,
        {
            "id": uuid.uuid4().hex,
            "title": title.strip(),
            "file_name": original_name,
            "stored_name": stored_name,
            "uploaded_at": now.isoformat(timespec="seconds"),
            "extension": extension,
            "mime_type": uploaded_file.type or mimetypes.guess_type(original_name)[0] or "application/octet-stream",
            "size": int(uploaded_file.size),
        },
    )
    _save_metadata(records)


def _filtered_records(records: list[dict[str, object]], year_label: str, title_label: str) -> list[dict[str, object]]:
    filtered = records
    if year_label != "Tahun: Semua":
        year = int(year_label.replace("Tahun: ", ""))
        filtered = [record for record in filtered if _record_year(record) == year]
    if title_label != "Judul: Semua":
        title = title_label.replace("Judul: ", "", 1)
        filtered = [record for record in filtered if str(record.get("title", "")) == title]
    return filtered


def _preview_pdf(path: Path) -> None:
    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    st.markdown(
        f"<iframe class='archive-pdf-preview' src='data:application/pdf;base64,{encoded}'></iframe>",
        unsafe_allow_html=True,
    )


def _preview_table(path: Path, extension: str) -> None:
    if extension == "csv":
        df = pd.read_csv(path)
    else:
        df = pd.read_excel(path)
    st.dataframe(df.head(500), use_container_width=True, height=460, hide_index=True)


def _render_preview_dialog(records_by_id: dict[str, dict[str, object]]) -> None:
    preview_id = st.session_state.get("archive_preview_id")
    if not preview_id:
        return
    record = records_by_id.get(preview_id)
    if not record:
        st.session_state.archive_preview_id = None
        return

    @st.dialog(f"Preview - {record.get('title', 'Arsip')}", width="large")
    def preview_dialog() -> None:
        path = ARCHIVE_DIR / str(record.get("stored_name", ""))
        extension = str(record.get("extension", "")).lower()
        st.caption(f"{record.get('file_name', '')} | {_upload_time_label(str(record.get('uploaded_at', '')))}")
        if not path.exists():
            st.warning("File arsip tidak ditemukan di folder penyimpanan.")
        elif extension in IMAGE_EXTENSIONS:
            st.image(str(path), use_container_width=True)
        elif extension in PDF_EXTENSIONS:
            _preview_pdf(path)
        elif extension in TABLE_EXTENSIONS:
            try:
                _preview_table(path, extension)
            except Exception as exc:
                st.warning("Preview tabel tidak dapat ditampilkan. File tetap dapat diunduh.")
                st.caption(str(exc))
        elif extension in {"txt", "md", "json", "xml", "html"}:
            try:
                st.code(path.read_text(encoding="utf-8")[:12000], language="text")
            except Exception:
                st.warning("Preview teks tidak dapat ditampilkan. File tetap dapat diunduh.")
        else:
            st.info("Preview untuk format ini belum didukung. Silakan gunakan tombol Download pada card arsip.")
        if st.button("Tutup", use_container_width=True):
            st.session_state.archive_preview_id = None
            st.rerun()

    preview_dialog()


def _render_archive_card(record: dict[str, object]) -> None:
    extension = str(record.get("extension", "file")).lower()
    path = ARCHIVE_DIR / str(record.get("stored_name", ""))
    size = int(record.get("size", 0) or 0)
    title = escape(str(record.get("title", "Tanpa Judul")))
    file_name = escape(str(record.get("file_name", "-")))
    uploaded_at = escape(_upload_time_label(str(record.get("uploaded_at", "-"))))
    mime_type = escape(str(record.get("mime_type", extension.upper())))

    st.markdown("<div class='archive-row-anchor'></div>", unsafe_allow_html=True)
    info_col, preview_col, download_col = st.columns([6.8, 1.25, 1.35], vertical_alignment="center")
    with info_col:
        st.markdown(
            f"""
            <div class='archive-row-info'>
                <div class='archive-icon'>{_file_icon(extension)}</div>
                <div class='archive-info'>
                    <h3>{title}</h3>
                    <p>{file_name}</p>
                    <div class='archive-meta'>
                        <span>{uploaded_at}</span>
                        <span>{extension.upper()}</span>
                        <span>{_format_size(size)}</span>
                        <span>{mime_type}</span>
                    </div>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with preview_col:
        if st.button("Preview", icon=":material/visibility:", use_container_width=True, key=f"preview_{record.get('id')}"):
            st.session_state.archive_preview_id = str(record.get("id"))
            st.rerun()
    with download_col:
        if path.exists():
            st.download_button(
                "Download",
                data=path.read_bytes(),
                file_name=str(record.get("file_name", path.name)),
                mime=str(record.get("mime_type", "application/octet-stream")),
                icon=":material/download:",
                use_container_width=True,
                key=f"download_{record.get('id')}",
            )
        else:
            st.button("Download", disabled=True, icon=":material/download:", use_container_width=True, key=f"missing_{record.get('id')}")


def render_archive() -> None:
    records = _load_metadata()
    years = sorted({year for year in (_record_year(record) for record in records) if year is not None}, reverse=True)
    titles = sorted({str(record.get("title", "")) for record in records if str(record.get("title", "")).strip()})

    st.markdown(
        f"""
        <div class='archive-topbar'>
            <div>
                <h1>Arsip</h1>
                <p>{len(records)} file tersimpan</p>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.form("archive_upload_form", clear_on_submit=True):
        st.markdown("<div class='archive-form-title'>Upload Arsip</div>", unsafe_allow_html=True)
        title_col, file_col, submit_col = st.columns([2.2, 2.8, 0.9], vertical_alignment="bottom")
        with title_col:
            title = st.text_input("Title / Judul", placeholder="Judul dokumen")
        with file_col:
            uploaded_file = st.file_uploader("File", type=ALLOWED_EXTENSIONS)
        with submit_col:
            submitted = st.form_submit_button("Upload", type="primary", icon=":material/upload_file:", use_container_width=True)
        if submitted:
            if not title.strip():
                st.warning("Title/Judul wajib diisi.")
            elif uploaded_file is None:
                st.warning("File wajib dipilih.")
            else:
                _save_archive(title, uploaded_file)
                st.cache_data.clear()
                st.rerun()

    filter_left, filter_mid, filter_right = st.columns([1.0, 1.4, 4.0], vertical_alignment="bottom")
    with filter_left:
        year_selected = st.selectbox("Tahun", ["Tahun: Semua"] + [f"Tahun: {year}" for year in years])
    with filter_mid:
        title_selected = st.selectbox("Judul", ["Judul: Semua"] + [f"Judul: {title}" for title in titles])
    with filter_right:
        st.markdown("<div class='archive-filter-spacer'></div>", unsafe_allow_html=True)

    records = _load_metadata()
    filtered = _filtered_records(records, year_selected, title_selected)
    records_by_id = {str(record.get("id")): record for record in records}
    _render_preview_dialog(records_by_id)

    st.markdown(f"<div class='archive-list-title'>Daftar Arsip <span>{len(filtered)} ditampilkan</span></div>", unsafe_allow_html=True)
    if not filtered:
        st.markdown(
            """
            <div class='empty-state compact'>
                <h3>Belum ada arsip</h3>
                <p>Unggah file arsip atau ubah filter untuk melihat dokumen yang tersedia.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    for record in filtered:
        _render_archive_card(record)




