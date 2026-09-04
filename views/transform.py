from __future__ import annotations

from io import BytesIO
from pathlib import Path
import json

import pandas as pd
import streamlit as st

from config.settings import TRANSFORMED_DIR, UPLOAD_DIR
from services.database import test_connection
from services.excel_reader import ExcelReadError, list_sheets, read_excel_file, read_excel_preview
from services.repository import get_existing_nomor_surat, get_latest_batch_id, get_records_by_batch, get_upload_batches, insert_valid_records, replace_batch_records, save_upload_batch, save_validation_errors
from services.transformer import transform_sanction_data
from services.validator import REQUIRED_COLUMNS, validate_structure, validate_transformed_data


def _excel_bytes(df: pd.DataFrame) -> bytes:
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="data")
    return buffer.getvalue()


def _template_bytes() -> bytes:
    template = pd.DataFrame(columns=REQUIRED_COLUMNS)
    return _excel_bytes(template)


def _format_size(size: int) -> str:
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.2f} MB"
    return f"{size / 1024:.2f} KB"


def _init_state() -> None:
    defaults = {
        "uploaded_path": None,
        "uploaded_name": None,
        "sheet_names": [],
        "selected_sheet": None,
        "raw_df": None,
        "preview_df": None,
        "transformed_df": None,
        "valid_df": None,
        "invalid_df": None,
        "errors_df": None,
        "duplicate_df": None,
        "structure_result": None,
        "existing_duplicates": set(),
        "save_result": None,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def _save_uploaded_file(uploaded_file) -> Path:
    safe_name = Path(uploaded_file.name).name
    target = UPLOAD_DIR / safe_name
    target.write_bytes(uploaded_file.getbuffer())
    return target


def _load_latest_upload_from_disk() -> bool:
    meta_path = TRANSFORMED_DIR / "latest_upload_meta.json"
    if not meta_path.exists():
        return False
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        raw_path = Path(meta.get("latest_raw_path") or meta.get("raw_path") or "")
        transformed_path = Path(meta.get("latest_transformed_path") or "")
        if raw_path.exists():
            raw_df = pd.read_excel(raw_path, dtype=str)
            st.session_state.uploaded_path = str(raw_path)
            st.session_state.uploaded_name = meta.get("file_name", raw_path.name)
            st.session_state.sheet_names = [meta.get("sheet_name", "Data Sanksi")]
            st.session_state.selected_sheet = st.session_state.sheet_names[0]
            st.session_state.raw_df = raw_df
            st.session_state.raw_edit_df = raw_df.copy()
            st.session_state.preview_df = raw_df.head(20)
            st.session_state.structure_result = validate_structure(raw_df)
        if transformed_path.exists():
            transformed_df = pd.read_excel(transformed_path)
            st.session_state.transformed_df = transformed_df
            validation = validate_transformed_data(transformed_df)
            st.session_state.valid_df = validation.valid_df
            st.session_state.invalid_df = validation.invalid_df
            st.session_state.errors_df = validation.errors_df
            st.session_state.duplicate_df = validation.duplicate_df
            st.session_state.dashboard_local_df = validation.valid_df.copy()
        return st.session_state.raw_df is not None or st.session_state.transformed_df is not None
    except Exception:
        return False


def _render_structure(result, row_count: int) -> None:
    st.markdown("<div class='section-card'>", unsafe_allow_html=True)
    st.subheader("Validasi Struktur")
    st.caption(f"Jumlah baris data: {row_count}")
    rows = []
    for column in REQUIRED_COLUMNS:
        rows.append({"kolom_wajib": column, "status": "Ditemukan" if column in result.found_columns else "Tidak ditemukan"})
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    if not result.is_valid:
        st.error("Struktur Excel belum sesuai. Data tidak akan masuk database.")
        st.write("Kolom ditemukan:", result.found_columns)
        st.write("Kolom hilang:", result.missing_columns)
        st.info("Perbaiki nama header agar sesuai template. Sistem toleran kapitalisasi, spasi ganda, dan line break tersembunyi.")
        st.download_button("Download Template Excel", data=_template_bytes(), file_name="template_data_sanksi.xlsx")
    st.markdown("</div>", unsafe_allow_html=True)


def render_transform(on_upload_done=None) -> None:
    _init_state()

    st.markdown("<div class='transform-header'><h2>Transform</h2><p>Upload, validasi, transformasi, dan simpan data sanksi ke MariaDB/MySQL XAMPP.</p></div>", unsafe_allow_html=True)

    ok, message = test_connection()

    batches = pd.DataFrame()
    try:
        batches = get_upload_batches()
    except Exception:
        batches = pd.DataFrame()

    if st.session_state.get("active_batch_id") is None:
        st.session_state.active_batch_id = st.session_state.get("last_uploaded_batch_id")
        if st.session_state.active_batch_id is None:
            try:
                st.session_state.active_batch_id = get_latest_batch_id()
            except Exception:
                st.session_state.active_batch_id = None

    if st.session_state.raw_df is None and st.session_state.transformed_df is None:
        _load_latest_upload_from_disk()

    if st.session_state.uploaded_path and st.session_state.raw_df is None:
        try:
            if not st.session_state.sheet_names:
                st.session_state.sheet_names = list_sheets(st.session_state.uploaded_path)
            if not st.session_state.selected_sheet and st.session_state.sheet_names:
                st.session_state.selected_sheet = st.session_state.sheet_names[0]
            if st.session_state.selected_sheet:
                raw_df = read_excel_file(st.session_state.uploaded_path, st.session_state.selected_sheet)
                st.session_state.raw_df = raw_df
                st.session_state.raw_edit_df = raw_df.copy()
                st.session_state.preview_df = raw_df.head(20)
                st.session_state.structure_result = validate_structure(raw_df)
        except ExcelReadError as exc:
            st.error(str(exc))

    if st.session_state.raw_df is None and st.session_state.active_batch_id:
        try:
            batch_df = get_records_by_batch(int(st.session_state.active_batch_id))
            if not batch_df.empty:
                st.session_state.transformed_df = batch_df.drop(columns=["upload_batch_id"], errors="ignore")
                validation = validate_transformed_data(st.session_state.transformed_df)
                st.session_state.valid_df = validation.valid_df
                st.session_state.invalid_df = validation.invalid_df
                st.session_state.errors_df = validation.errors_df
                st.session_state.duplicate_df = validation.duplicate_df
        except Exception:
            pass

    if st.session_state.transformed_df is None:
        local_df = st.session_state.get("dashboard_local_df")
        if local_df is not None and not local_df.empty:
            st.session_state.transformed_df = local_df.copy()
            validation = validate_transformed_data(st.session_state.transformed_df)
            st.session_state.valid_df = validation.valid_df
            st.session_state.invalid_df = validation.invalid_df
            st.session_state.errors_df = validation.errors_df
            st.session_state.duplicate_df = validation.duplicate_df

    if st.session_state.transformed_df is not None and st.session_state.raw_df is None:
        st.markdown("<div class='section-card active-data-card'>", unsafe_allow_html=True)
        st.subheader("Data Terakhir Aktif")
        st.caption("Data ini berasal dari upload atau batch terakhir. Silakan edit langsung, lalu simpan untuk memperbarui dashboard.")
        edited_active = st.data_editor(
            st.session_state.transformed_df,
            use_container_width=True,
            height=420,
            num_rows="dynamic",
            key="active_batch_editor_top",
        )
        st.session_state.transformed_df = edited_active
        validation_active = validate_transformed_data(edited_active)
        st.session_state.valid_df = validation_active.valid_df
        st.session_state.invalid_df = validation_active.invalid_df
        st.session_state.errors_df = validation_active.errors_df
        st.session_state.duplicate_df = validation_active.duplicate_df
        st.markdown("</div>", unsafe_allow_html=True)

    upload_panel, option_panel = st.columns([1.05, 0.95])

    with upload_panel:
        st.markdown("<div class='section-card'>", unsafe_allow_html=True)
        st.subheader("Batch / Upload")
        if st.session_state.transformed_df is not None or st.session_state.raw_df is not None:
            active_name = st.session_state.get("uploaded_name") or "Batch terakhir"
            st.markdown(f"<div class='active-data-pill'>Data aktif: {active_name}</div>", unsafe_allow_html=True)
        if not batches.empty:
            batch_labels = [f"#{int(row.id)} - {row.file_name} ({int(row.valid_rows)} data valid)" for row in batches.itertuples()]
            current_label = batch_labels[0]
            if st.session_state.active_batch_id in set(batches["id"].astype(int)):
                current_label = batch_labels[batches["id"].astype(int).tolist().index(int(st.session_state.active_batch_id))]
            selected_batch = st.selectbox("Riwayat upload", batch_labels, index=batch_labels.index(current_label))
            selected_batch_id = int(selected_batch.split(" - ")[0].replace("#", ""))
            if selected_batch_id != st.session_state.active_batch_id:
                st.session_state.active_batch_id = selected_batch_id
                st.session_state.raw_df = None
                st.session_state.raw_edit_df = None
                st.session_state.transformed_df = None
                st.rerun()
        with st.expander("Upload file baru", expanded=st.session_state.transformed_df is None and st.session_state.raw_df is None):
            uploaded_file = st.file_uploader("Drag and drop file Excel", type=["xlsx", "xls"])
            if uploaded_file:
                path = _save_uploaded_file(uploaded_file)
                st.session_state.uploaded_path = str(path)
                st.session_state.uploaded_name = uploaded_file.name
                st.session_state.save_result = None
                st.info(f"{uploaded_file.name} - {_format_size(uploaded_file.size)}")
                try:
                    st.session_state.sheet_names = list_sheets(path)
                except ExcelReadError as exc:
                    st.error(str(exc))
        if st.session_state.sheet_names:
            default_index = st.session_state.sheet_names.index(st.session_state.selected_sheet) if st.session_state.selected_sheet in st.session_state.sheet_names else 0
            st.session_state.selected_sheet = st.selectbox("Pilih sheet", st.session_state.sheet_names, index=default_index, key="sheet_select")
            if st.button("Baca Data", type="primary"):
                try:
                    raw_df = read_excel_file(st.session_state.uploaded_path, st.session_state.selected_sheet)
                    preview_df = read_excel_preview(st.session_state.uploaded_path, st.session_state.selected_sheet)
                    if raw_df.empty:
                        st.error("Sheet kosong. Pilih sheet lain atau isi data terlebih dahulu.")
                    else:
                        st.session_state.raw_df = raw_df
                        st.session_state.preview_df = preview_df
                        st.session_state.structure_result = validate_structure(raw_df)
                        st.session_state.raw_edit_df = raw_df.copy()
                        st.success("Data berhasil dibaca.")
                except ExcelReadError as exc:
                    st.error(str(exc))
        st.download_button("Download Template Excel", data=_template_bytes(), file_name="template_data_sanksi.xlsx", use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with option_panel:
        st.markdown("<div class='section-card'>", unsafe_allow_html=True)
        st.subheader("Opsi Transformasi")
        trim_spaces = st.checkbox("Trim spasi", value=True)
        standardize_department = st.checkbox("Standardisasi departemen", value=True)
        standardize_type = st.checkbox("Standardisasi jenis sanksi", value=True)
        parse_dates = st.checkbox("Parsing tanggal", value=True)
        drop_empty = st.checkbox("Hapus baris kosong", value=True)
        detect_duplicates = st.checkbox("Deteksi duplikat", value=True)
        calculate_duration = st.checkbox("Hitung durasi", value=True)
        calculate_status = st.checkbox("Hitung status", value=True)
        create_period = st.checkbox("Buat periode", value=True)
        st.caption("Opsi disediakan untuk kontrol proses. Transformasi inti tetap menjaga standar data wajib.")
        st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.structure_result is not None and st.session_state.raw_df is not None:
        _render_structure(st.session_state.structure_result, len(st.session_state.raw_df))

        st.markdown("<div class='section-card'>", unsafe_allow_html=True)
        st.subheader("Edit dan Bersihkan Data Mentah")
        st.caption("Perbaiki nilai kosong, format tanggal, departemen, jenis sanksi, jabatan, atau uraian sebelum transformasi.")
        editable_source = st.session_state.get("raw_edit_df")
        if editable_source is None:
            editable_source = st.session_state.raw_df.copy()
        edited_raw = st.data_editor(editable_source, use_container_width=True, height=320, num_rows="dynamic", key="raw_data_editor")
        st.session_state.raw_edit_df = edited_raw
        st.markdown("</div>", unsafe_allow_html=True)

        if st.session_state.structure_result.is_valid:
            if st.button("Jalankan Transformasi", type="primary"):
                transformed = transform_sanction_data(st.session_state.raw_edit_df)
                validation = validate_transformed_data(transformed)
                st.session_state.transformed_df = transformed
                st.session_state.valid_df = validation.valid_df
                st.session_state.invalid_df = validation.invalid_df
                st.session_state.errors_df = validation.errors_df
                st.session_state.duplicate_df = validation.duplicate_df
                try:
                    st.session_state.existing_duplicates = get_existing_nomor_surat(validation.valid_df["nomor_surat_sanksi"].dropna().astype(str).tolist())
                except Exception:
                    st.session_state.existing_duplicates = set()
                output_path = TRANSFORMED_DIR / f"transformed_{Path(st.session_state.uploaded_name).stem}.xlsx"
                transformed.to_excel(output_path, index=False)
                st.success("Transformasi selesai.")

    if st.session_state.transformed_df is not None:
        valid_df = st.session_state.valid_df
        invalid_df = st.session_state.invalid_df
        errors_df = st.session_state.errors_df
        duplicate_df = st.session_state.duplicate_df
        existing_duplicates = st.session_state.existing_duplicates

        m1, m2, m3 = st.columns(3)
        m1.metric("Data Valid", len(valid_df))
        m2.metric("Data Tidak Valid", len(invalid_df))
        m3.metric("Duplikat", len(duplicate_df) + len(existing_duplicates))

        st.markdown("<div class='section-card'>", unsafe_allow_html=True)
        st.subheader("Edit Hasil Transformasi")
        st.caption("Tinjau tipe data, tanggal, status, durasi, periode, dan duplikat sebelum simpan.")
        edited_transformed = st.data_editor(st.session_state.transformed_df, use_container_width=True, height=320, num_rows="dynamic", key="transformed_data_editor")
        st.session_state.transformed_df = edited_transformed
        validation_after_edit = validate_transformed_data(edited_transformed)
        st.session_state.valid_df = validation_after_edit.valid_df
        st.session_state.invalid_df = validation_after_edit.invalid_df
        st.session_state.errors_df = validation_after_edit.errors_df
        st.session_state.duplicate_df = validation_after_edit.duplicate_df
        valid_df = st.session_state.valid_df
        invalid_df = st.session_state.invalid_df
        errors_df = st.session_state.errors_df
        duplicate_df = st.session_state.duplicate_df
        st.markdown("</div>", unsafe_allow_html=True)

        if not errors_df.empty:
            st.markdown("<div class='section-card'>", unsafe_allow_html=True)
            st.subheader("Laporan Error")
            st.dataframe(errors_df, use_container_width=True, height=220, hide_index=True)
            st.download_button("Download Laporan Error", data=_excel_bytes(errors_df), file_name="laporan_error_sanksi.xlsx")
            st.markdown("</div>", unsafe_allow_html=True)

        if existing_duplicates:
            st.warning(f"Ada {len(existing_duplicates)} nomor surat yang sudah ada di database.")

        st.markdown("<div class='section-card'>", unsafe_allow_html=True)
        st.subheader("Simpan ke Database")
        mode_label = st.radio(
            "Mode simpan",
            ["Tambah Data", "Abaikan Data Duplikat", "Ganti Data Lama", "Batalkan Proses Upload"],
            horizontal=True,
        )
        mode_map = {
            "Tambah Data": "append",
            "Abaikan Data Duplikat": "ignore_duplicates",
            "Ganti Data Lama": "replace",
            "Batalkan Proses Upload": "cancel",
        }
        confirmed = st.checkbox("Saya sudah memeriksa preview dan ingin menyimpan data valid.")
        if st.button("Simpan ke Database", type="primary", disabled=not confirmed or mode_map[mode_label] == "cancel"):
            try:
                if st.session_state.get("active_batch_id") and mode_map[mode_label] == "replace":
                    batch_id = int(st.session_state.active_batch_id)
                    inserted = replace_batch_records(valid_df, upload_batch_id=batch_id)
                else:
                    batch_id = save_upload_batch(
                        file_name=st.session_state.uploaded_name or "upload.xlsx",
                        sheet_name=st.session_state.selected_sheet or "Sheet1",
                        total_rows=len(st.session_state.transformed_df),
                        valid_rows=len(valid_df),
                        invalid_rows=len(invalid_df),
                        duplicate_rows=len(duplicate_df) + len(existing_duplicates),
                        mode=mode_map[mode_label],
                    )
                    inserted = insert_valid_records(valid_df, upload_batch_id=batch_id, mode=mode_map[mode_label])
                    st.session_state.active_batch_id = batch_id
                    st.session_state.last_uploaded_batch_id = batch_id
                save_validation_errors(errors_df, upload_batch_id=batch_id)
                existing_local = st.session_state.get("dashboard_local_df")
                combined = valid_df.copy() if existing_local is None else pd.concat([existing_local, valid_df], ignore_index=True)
                if "nomor_surat_sanksi" in combined.columns:
                    combined = combined.drop_duplicates("nomor_surat_sanksi", keep="last")
                st.session_state.dashboard_local_df = combined
                try:
                    latest_transformed_path = TRANSFORMED_DIR / "latest_transformed.xlsx"
                    latest_raw_path = TRANSFORMED_DIR / "latest_raw.xlsx"
                    latest_meta_path = TRANSFORMED_DIR / "latest_upload_meta.json"
                    valid_df.to_excel(latest_transformed_path, index=False)
                    source_raw = st.session_state.get("raw_edit_df")
                    if source_raw is not None:
                        source_raw.to_excel(latest_raw_path, index=False)
                    latest_meta_path.write_text(
                        json.dumps(
                            {
                                "file_name": st.session_state.uploaded_name or "Batch terakhir",
                                "sheet_name": st.session_state.selected_sheet or "Data Sanksi",
                                "latest_raw_path": str(latest_raw_path),
                                "latest_transformed_path": str(latest_transformed_path),
                            },
                            indent=2,
                        ),
                        encoding="utf-8",
                    )
                except Exception:
                    pass
                st.cache_data.clear()
                st.session_state.save_result = f"{inserted} data valid berhasil disimpan. {len(invalid_df)} data tidak valid tidak masuk tabel utama."
            except Exception as exc:
                st.error("Gagal menyimpan ke database. Periksa koneksi MySQL, struktur tabel, dan kemungkinan duplikat nomor surat.")
                st.caption(str(exc))
        if st.session_state.save_result:
            st.success(st.session_state.save_result)
            if on_upload_done and st.button("Kembali ke Dashboard"):
                on_upload_done()
                st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

        d1, d2 = st.columns(2)
        with d1:
            st.download_button("Download Data Transformasi", data=_excel_bytes(st.session_state.transformed_df), file_name="hasil_transformasi_sanksi.xlsx", use_container_width=True)
        with d2:
            st.download_button("Download Data Error", data=_excel_bytes(errors_df), file_name="data_error_sanksi.xlsx", use_container_width=True)
