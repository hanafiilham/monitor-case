from __future__ import annotations

from difflib import SequenceMatcher
from pathlib import Path
import re

import pandas as pd
from sqlalchemy import delete, extract, select, update
from werkzeug.security import check_password_hash, generate_password_hash

from models.database_models import AppUser, ArchiveDocument, AuditLog, EmployeeMaster, EmployeeMasterBatch, ReportProgress, Sanction, SanctionDurationMaster, UploadBatch, ValidationError
from services.database import create_tables, session_scope
from services.transformer import standardize_department


SANCTION_COLUMNS = [
    "nomor_surat_sanksi",
    "tanggal_mulai_sanksi",
    "tanggal_berakhir_sanksi",
    "perner_karyawan",
    "nama_karyawan",
    "jabatan_karyawan",
    "departemen_seksi",
    "jenis_sanksi",
    "uraian_pelanggaran",
    "durasi_sanksi_hari",
    "status_sanksi",
    "bulan_sanksi",
    "tahun_sanksi",
    "periode_sanksi",
]

EMPLOYEE_MASTER_COLUMNS = [
    "perner_karyawan",
    "nama_karyawan",
    "jabatan_karyawan",
    "departemen_seksi",
]


def normalize_perner(value: object) -> str:
    return str(value or "").strip()


def ensure_app_user(perner: str, password: str) -> None:
    perner_value = normalize_perner(perner)
    if not perner_value or not password:
        return
    create_tables()
    with session_scope() as session:
        existing = session.execute(select(AppUser).where(AppUser.perner == perner_value)).scalar_one_or_none()
        if existing is not None:
            return
        session.add(AppUser(perner=perner_value, password_hash=generate_password_hash(password)))
        session.add(AuditLog(action="auth_user_seed", message=f"User login PERNER {perner_value} dibuat."))


def authenticate_app_user(perner: str, password: str) -> dict[str, object] | None:
    perner_value = normalize_perner(perner)
    if not perner_value or not password:
        return None
    create_tables()
    with session_scope() as session:
        row = session.execute(select(AppUser).where(AppUser.perner == perner_value)).scalar_one_or_none()
        if row is None or not check_password_hash(row.password_hash, password):
            return None
        return {"id": row.id, "perner": row.perner}


def change_app_user_password(perner: str, old_password: str, new_password: str) -> bool:
    perner_value = normalize_perner(perner)
    if not perner_value or not old_password or not new_password:
        return False
    create_tables()
    with session_scope() as session:
        row = session.execute(select(AppUser).where(AppUser.perner == perner_value)).scalar_one_or_none()
        if row is None or not check_password_hash(row.password_hash, old_password):
            return False
        row.password_hash = generate_password_hash(new_password)
        session.add(AuditLog(action="auth_password_change", message=f"Password user PERNER {perner_value} diubah."))
        return True

SANCTION_DURATION_COLUMNS = ["jenis_sanksi", "durasi_hari"]


def dataframe_to_mysql_records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []
    cleaned = df.astype(object).where(pd.notna(df), None)
    records = cleaned.to_dict(orient="records")
    for record in records:
        for key, value in list(record.items()):
            if pd.isna(value):
                record[key] = None
    return records


def save_dataframe_to_excel(df: pd.DataFrame, path: str | Path) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(output_path, index=False)
    return output_path


def save_upload_batch(file_name: str, sheet_name: str, total_rows: int, valid_rows: int, invalid_rows: int, duplicate_rows: int, mode: str) -> int:
    create_tables()
    with session_scope() as session:
        batch = UploadBatch(
            file_name=file_name,
            sheet_name=sheet_name,
            total_rows=total_rows,
            valid_rows=valid_rows,
            invalid_rows=invalid_rows,
            duplicate_rows=duplicate_rows,
            mode=mode,
        )
        session.add(batch)
        session.flush()
        session.add(AuditLog(action="upload_batch", message=f"Batch {file_name} dibuat dengan {valid_rows} data valid."))
        return int(batch.id)


def get_existing_nomor_surat(values: list[str]) -> set[str]:
    if not values:
        return set()
    create_tables()
    with session_scope() as session:
        rows = session.execute(select(Sanction.nomor_surat_sanksi).where(Sanction.nomor_surat_sanksi.in_(values))).all()
        return {row[0] for row in rows}


def insert_valid_records(df: pd.DataFrame, upload_batch_id: int, mode: str = "append") -> int:
    if df.empty:
        return 0

    create_tables()
    records = df[SANCTION_COLUMNS].copy()
    records["upload_batch_id"] = upload_batch_id
    payload = dataframe_to_mysql_records(records)
    nomor_values = [str(record["nomor_surat_sanksi"]) for record in payload]

    with session_scope() as session:
        if mode == "replace":
            session.execute(delete(Sanction).where(Sanction.nomor_surat_sanksi.in_(nomor_values)))
        elif mode == "ignore_duplicates":
            existing = set(
                row[0]
                for row in session.execute(
                    select(Sanction.nomor_surat_sanksi).where(Sanction.nomor_surat_sanksi.in_(nomor_values))
                ).all()
            )
            payload = [record for record in payload if record["nomor_surat_sanksi"] not in existing]

        session.bulk_insert_mappings(Sanction, payload)
        session.add(AuditLog(action="insert_sanctions", message=f"{len(payload)} data sanksi disimpan."))
        return len(payload)


def save_validation_errors(errors_df: pd.DataFrame, upload_batch_id: int | None = None) -> int:
    if errors_df.empty:
        return 0

    create_tables()
    payload = []
    for record in errors_df.where(pd.notna(errors_df), None).to_dict(orient="records"):
        payload.append(
            {
                "upload_batch_id": upload_batch_id,
                "excel_row": int(record.get("nomor_baris_excel", 0)),
                "column_name": str(record.get("nama_kolom", "")),
                "original_value": None if record.get("nilai_asli") is None else str(record.get("nilai_asli")),
                "error_type": str(record.get("jenis_kesalahan", "")),
                "suggestion": str(record.get("saran_perbaikan", "")),
            }
        )

    with session_scope() as session:
        session.bulk_insert_mappings(ValidationError, payload)
        return len(payload)



def sanctions_to_dataframe(rows: list[Sanction]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "nomor_surat_sanksi": row.nomor_surat_sanksi,
                "tanggal_mulai_sanksi": row.tanggal_mulai_sanksi,
                "tanggal_berakhir_sanksi": row.tanggal_berakhir_sanksi,
                "perner_karyawan": row.perner_karyawan,
                "nama_karyawan": row.nama_karyawan,
                "jabatan_karyawan": row.jabatan_karyawan,
                "departemen_seksi": standardize_department(row.departemen_seksi),
                "jenis_sanksi": row.jenis_sanksi,
                "uraian_pelanggaran": row.uraian_pelanggaran,
                "durasi_sanksi_hari": row.durasi_sanksi_hari,
                "status_sanksi": row.status_sanksi,
                "bulan_sanksi": row.bulan_sanksi,
                "tahun_sanksi": row.tahun_sanksi,
                "periode_sanksi": row.periode_sanksi,
                "upload_batch_id": row.upload_batch_id,
            }
            for row in rows
        ]
    )


def get_upload_batches(limit: int = 25) -> pd.DataFrame:
    create_tables()
    with session_scope() as session:
        rows = session.execute(select(UploadBatch).order_by(UploadBatch.id.desc()).limit(limit)).scalars().all()
    return pd.DataFrame(
        [
            {
                "id": row.id,
                "file_name": row.file_name,
                "sheet_name": row.sheet_name,
                "total_rows": row.total_rows,
                "valid_rows": row.valid_rows,
                "invalid_rows": row.invalid_rows,
                "created_at": row.created_at,
            }
            for row in rows
        ]
    )


def get_latest_batch_id() -> int | None:
    batches = get_upload_batches(limit=1)
    if batches.empty:
        return None
    return int(batches.iloc[0]["id"])


def get_records_by_batch(upload_batch_id: int) -> pd.DataFrame:
    create_tables()
    with session_scope() as session:
        rows = session.execute(select(Sanction).where(Sanction.upload_batch_id == upload_batch_id)).scalars().all()
    return sanctions_to_dataframe(rows)


def replace_batch_records(df: pd.DataFrame, upload_batch_id: int) -> int:
    create_tables()
    if df.empty:
        payload = []
    else:
        records = df[SANCTION_COLUMNS].copy()
        records["upload_batch_id"] = upload_batch_id
        payload = dataframe_to_mysql_records(records)
    with session_scope() as session:
        session.execute(delete(Sanction).where(Sanction.upload_batch_id == upload_batch_id))
        if payload:
            session.bulk_insert_mappings(Sanction, payload)
        session.add(AuditLog(action="replace_batch", message=f"Batch {upload_batch_id} diperbarui dengan {len(payload)} data."))
        return len(payload)

def delete_upload_batch(upload_batch_id: int) -> dict[str, object] | None:
    create_tables()
    with session_scope() as session:
        batch = session.get(UploadBatch, int(upload_batch_id))
        if batch is None:
            return None
        record = {
            "id": int(batch.id),
            "file_name": batch.file_name,
            "sheet_name": batch.sheet_name,
            "total_rows": batch.total_rows,
            "valid_rows": batch.valid_rows,
        }
        deleted_sanctions = session.execute(delete(Sanction).where(Sanction.upload_batch_id == batch.id)).rowcount or 0
        deleted_errors = session.execute(delete(ValidationError).where(ValidationError.upload_batch_id == batch.id)).rowcount or 0
        session.delete(batch)
        session.add(AuditLog(action="delete_upload_batch", message=f"Batch {record['file_name']} dihapus. Data: {deleted_sanctions}, error: {deleted_errors}."))
        record["deleted_sanctions"] = int(deleted_sanctions)
        record["deleted_errors"] = int(deleted_errors)
        return record

def get_filter_options() -> dict[str, list]:
    create_tables()
    with session_scope() as session:
        years = [row[0] for row in session.execute(select(Sanction.tahun_sanksi).distinct().order_by(Sanction.tahun_sanksi)).all()]
        departments = [row[0] for row in session.execute(select(Sanction.departemen_seksi).distinct().order_by(Sanction.departemen_seksi)).all()]
        sanction_types = [row[0] for row in session.execute(select(Sanction.jenis_sanksi).distinct().order_by(Sanction.jenis_sanksi)).all()]
        positions = [row[0] for row in session.execute(select(Sanction.jabatan_karyawan).distinct().order_by(Sanction.jabatan_karyawan)).all()]
        statuses = [row[0] for row in session.execute(select(Sanction.status_sanksi).distinct().order_by(Sanction.status_sanksi)).all()]
    return {"years": years, "departments": departments, "sanction_types": sanction_types, "positions": positions, "statuses": statuses}


def get_dashboard_records(
    year: int | None = None,
    month: int | None = None,
    department: str | None = None,
    sanction_type: str | None = None,
    status: str | None = None,
    position: str | None = None,
) -> pd.DataFrame:
    create_tables()
    with session_scope() as session:
        query = select(Sanction)
        if year:
            query = query.where(Sanction.tahun_sanksi == year)
        if month:
            query = query.where(Sanction.bulan_sanksi == month)
        if department:
            query = query.where(Sanction.departemen_seksi == department)
        if sanction_type:
            query = query.where(Sanction.jenis_sanksi == sanction_type)
        if status:
            query = query.where(Sanction.status_sanksi == status)
        if position:
            query = query.where(Sanction.jabatan_karyawan == position)
        rows = session.execute(query).scalars().all()

    return sanctions_to_dataframe(rows)


def get_dashboard_data(
    year: int | None = None,
    month: int | None = None,
    department: str | None = None,
    sanction_type: str | None = None,
    status: str | None = None,
    position: str | None = None,
) -> pd.DataFrame:
    return get_dashboard_records(year=year, month=month, department=department, sanction_type=sanction_type, status=status, position=position)

def archive_to_dict(row: ArchiveDocument) -> dict[str, object]:
    return {
        "id": str(row.id),
        "title": row.title,
        "file_name": row.file_name,
        "stored_name": row.stored_name,
        "uploaded_at": row.uploaded_at.isoformat() if hasattr(row.uploaded_at, "isoformat") else str(row.uploaded_at),
        "extension": row.extension,
        "mime_type": row.mime_type,
        "size": row.size,
    }


def save_archive_document(
    title: str,
    file_name: str,
    stored_name: str,
    extension: str,
    mime_type: str,
    size: int,
    uploaded_at=None,
) -> int:
    create_tables()
    with session_scope() as session:
        document = ArchiveDocument(
            title=title,
            file_name=file_name,
            stored_name=stored_name,
            extension=extension,
            mime_type=mime_type,
            size=size,
        )
        if uploaded_at is not None:
            document.uploaded_at = uploaded_at
        session.add(document)
        session.flush()
        session.add(AuditLog(action="archive_upload", message=f"Arsip {file_name} disimpan."))
        return int(document.id)


def get_archive_documents(year: int | None = None, title: str | None = None) -> list[dict[str, object]]:
    create_tables()
    with session_scope() as session:
        query = select(ArchiveDocument)
        if year:
            query = query.where(extract("year", ArchiveDocument.uploaded_at) == year)
        if title:
            query = query.where(ArchiveDocument.title == title)
        rows = session.execute(query.order_by(ArchiveDocument.uploaded_at.desc(), ArchiveDocument.id.desc())).scalars().all()
    return [archive_to_dict(row) for row in rows]


def get_archive_filter_options() -> dict[str, list]:
    create_tables()
    with session_scope() as session:
        years = [int(row[0]) for row in session.execute(select(extract("year", ArchiveDocument.uploaded_at)).distinct().order_by(extract("year", ArchiveDocument.uploaded_at).desc())).all() if row[0] is not None]
        titles = [row[0] for row in session.execute(select(ArchiveDocument.title).distinct().order_by(ArchiveDocument.title)).all() if row[0]]
    return {"years": years, "titles": titles}


def get_archive_document(archive_id: int | str) -> dict[str, object] | None:
    create_tables()
    with session_scope() as session:
        row = session.get(ArchiveDocument, int(archive_id))
        return archive_to_dict(row) if row else None


def archive_stored_names() -> set[str]:
    create_tables()
    with session_scope() as session:
        return {row[0] for row in session.execute(select(ArchiveDocument.stored_name)).all()}



def delete_archive_document(archive_id: int | str) -> dict[str, object] | None:
    create_tables()
    with session_scope() as session:
        row = session.get(ArchiveDocument, int(archive_id))
        if row is None:
            return None
        record = archive_to_dict(row)
        session.delete(row)
        session.add(AuditLog(action="archive_delete", message=f"Arsip {record.get('file_name')} dihapus."))
        return record

EMPLOYEE_COLUMN_ALIASES = {
    "perner_karyawan": {"perner", "perner karyawan", "perner_karyawan", "nik", "id karyawan", "employee id", "employee_id", "personnel number", "nrp"},
    "nama_karyawan": {"nama", "nama karyawan", "nama_karyawan", "employee name", "full name", "full_name", "nama lengkap"},
    "jabatan_karyawan": {"jabatan", "jabatan karyawan", "jabatan_karyawan", "position", "posisi", "job title", "title"},
    "departemen_seksi": {"departemen", "departemen/seksi", "departemen_seksi", "seksi", "department", "dept", "unit", "bagian", "divisi"},
}


def _header_key(value: object) -> str:
    text = "" if value is None else str(value)
    text = re.sub(r"\s+", " ", text.strip().lower())
    return re.sub(r"[^a-z0-9]+", "", text)


def _find_alias_column(columns: list[object], aliases: set[str]) -> object | None:
    alias_keys = {_header_key(alias) for alias in aliases if _header_key(alias)}
    keyed_columns = [(_header_key(column), column) for column in columns]
    for key, column in keyed_columns:
        if key in alias_keys:
            return column
    for key, column in keyed_columns:
        if key and any(len(alias) >= 4 and (alias in key or key in alias) for alias in alias_keys):
            return column
    best_column = None
    best_score = 0.0
    for key, column in keyed_columns:
        for alias in alias_keys:
            if not key or not alias:
                continue
            score = SequenceMatcher(None, key, alias).ratio()
            if score > best_score:
                best_score = score
                best_column = column
    return best_column if best_score >= 0.86 else None


def normalize_employee_master_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=EMPLOYEE_MASTER_COLUMNS)
    rename_map = {}
    used_columns = set()
    for target, aliases in EMPLOYEE_COLUMN_ALIASES.items():
        original = _find_alias_column([column for column in df.columns if column not in used_columns], {target, *aliases})
        if original is not None:
            rename_map[original] = target
            used_columns.add(original)
    result = df.rename(columns=rename_map).copy()
    for column in EMPLOYEE_MASTER_COLUMNS:
        if column not in result.columns:
            result[column] = ""
    result = result[EMPLOYEE_MASTER_COLUMNS].fillna("").astype(str)
    for column in EMPLOYEE_MASTER_COLUMNS:
        result[column] = result[column].str.strip()
    return result


def validate_employee_master_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, object]]]:
    normalized = normalize_employee_master_dataframe(df)
    errors: list[dict[str, object]] = []
    if normalized.empty:
        return normalized, [{"row": 0, "column": "file", "message": "Data master kosong."}]
    duplicates = normalized[normalized["perner_karyawan"].duplicated(keep=False) & (normalized["perner_karyawan"] != "")]
    for index, row in normalized.iterrows():
        row_no = int(index) + 2
        for column, label in [
            ("perner_karyawan", "PERNER KARYAWAN"),
            ("nama_karyawan", "NAMA KARYAWAN"),
        ]:
            if not str(row.get(column, "")).strip():
                errors.append({"row": row_no, "column": column, "message": f"{label} wajib diisi."})
    for perner in sorted(set(duplicates["perner_karyawan"].tolist())):
        errors.append({"row": "-", "column": "perner_karyawan", "message": f"PERNER duplikat di file: {perner}"})
    return normalized, errors


def employee_master_to_dataframe(rows: list[EmployeeMaster]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "perner_karyawan": row.perner_karyawan,
            "nama_karyawan": row.nama_karyawan,
            "jabatan_karyawan": row.jabatan_karyawan,
            "departemen_seksi": row.departemen_seksi,
            "updated_at": row.updated_at,
        }
        for row in rows
    ])


def get_employee_master(search: str | None = None, status: str | None = None, limit: int | None = None) -> pd.DataFrame:
    create_tables()
    with session_scope() as session:
        query = select(EmployeeMaster).order_by(EmployeeMaster.perner_karyawan)
        if status and status != "all":
            query = query.where(EmployeeMaster.status_karyawan == status)
        rows = session.execute(query).scalars().all()
    df = employee_master_to_dataframe(rows)
    if search and not df.empty:
        keyword = str(search).lower().strip()
        df = df[
            df["perner_karyawan"].astype(str).str.lower().str.contains(keyword, regex=False)
            | df["nama_karyawan"].astype(str).str.lower().str.contains(keyword, regex=False)
        ]
    if limit:
        df = df.head(limit)
    return df


def get_employee_master_meta() -> dict[str, object]:
    create_tables()
    with session_scope() as session:
        batch = session.execute(select(EmployeeMasterBatch).order_by(EmployeeMasterBatch.id.desc()).limit(1)).scalar_one_or_none()
        total = session.execute(select(EmployeeMaster.id)).all()
    return {
        "total": len(total),
        "last_file": batch.file_name if batch else "-",
        "last_update": batch.created_at.isoformat() if batch and hasattr(batch.created_at, "isoformat") else (str(batch.created_at) if batch else "-"),
    }


def save_employee_master_batch(file_name: str, total_rows: int, valid_rows: int, invalid_rows: int, duplicate_rows: int, mode: str) -> int:
    create_tables()
    with session_scope() as session:
        batch = EmployeeMasterBatch(file_name=file_name, total_rows=total_rows, valid_rows=valid_rows, invalid_rows=invalid_rows, duplicate_rows=duplicate_rows, mode=mode)
        session.add(batch)
        session.flush()
        session.add(AuditLog(action="employee_master_batch", message=f"Master karyawan {file_name} diproses mode {mode}."))
        return int(batch.id)


def upsert_employee_master(df: pd.DataFrame, batch_id: int | None = None, mode: str = "update") -> int:
    normalized, errors = validate_employee_master_dataframe(df)
    if errors:
        raise ValueError("Master Data Karyawan belum valid. Perbaiki PERNER duplikat/kosong dan kolom wajib.")
    records = normalized[EMPLOYEE_MASTER_COLUMNS].where(pd.notna(normalized), "").to_dict(orient="records")
    create_tables()
    with session_scope() as session:
        if mode == "replace":
            session.execute(update(EmployeeMaster).values(status_karyawan="Nonaktif"))
        saved = 0
        for record in records:
            perner = str(record.get("perner_karyawan") or "").strip()
            existing = session.execute(select(EmployeeMaster).where(EmployeeMaster.perner_karyawan == perner)).scalar_one_or_none()
            payload = {
                "perner_karyawan": perner,
                "nama_karyawan": str(record.get("nama_karyawan") or "").strip(),
                "jabatan_karyawan": str(record.get("jabatan_karyawan") or "").strip(),
                "departemen_seksi": str(record.get("departemen_seksi") or "").strip(),
                "status_karyawan": "Aktif",
                "source_batch_id": batch_id,
            }
            if existing:
                for key, value in payload.items():
                    setattr(existing, key, value)
            else:
                session.add(EmployeeMaster(**payload))
            saved += 1
        session.add(AuditLog(action="employee_master_upsert", message=f"{saved} data master karyawan disimpan."))
        return saved


def delete_employee_master_by_perners(perners: list[str]) -> int:
    keys = sorted({str(perner or "").strip() for perner in perners if str(perner or "").strip()})
    if not keys:
        return 0
    create_tables()
    with session_scope() as session:
        result = session.execute(delete(EmployeeMaster).where(EmployeeMaster.perner_karyawan.in_(keys)))
        deleted = int(result.rowcount or 0)
        session.add(AuditLog(action="employee_master_delete", message=f"{deleted} data master karyawan dihapus."))
        return deleted


def sync_employee_master_changes(df: pd.DataFrame, deleted_perners: list[str] | None = None, mode: str = "update") -> dict[str, int]:
    normalized, errors = validate_employee_master_dataframe(df) if not df.empty else (pd.DataFrame(columns=EMPLOYEE_MASTER_COLUMNS), [])
    if errors:
        raise ValueError("Master Data Karyawan belum valid. Perbaiki PERNER duplikat/kosong dan kolom wajib.")
    delete_keys = sorted({str(perner or "").strip() for perner in (deleted_perners or []) if str(perner or "").strip()})
    records = normalized[EMPLOYEE_MASTER_COLUMNS].where(pd.notna(normalized), "").to_dict(orient="records") if not normalized.empty else []
    if not records and not delete_keys:
        raise ValueError("Tidak ada perubahan master data yang bisa disimpan.")
    create_tables()
    with session_scope() as session:
        batch_id = None
        if records:
            batch = EmployeeMasterBatch(file_name="Edit manual master", total_rows=len(normalized), valid_rows=len(normalized), invalid_rows=0, duplicate_rows=0, mode=mode)
            session.add(batch)
            session.flush()
            batch_id = int(batch.id)
            session.add(AuditLog(action="employee_master_batch", message=f"Master karyawan Edit manual master diproses mode {mode}."))
        if mode == "replace" and records:
            session.execute(update(EmployeeMaster).values(status_karyawan="Nonaktif"))
        deleted = 0
        if delete_keys:
            result = session.execute(delete(EmployeeMaster).where(EmployeeMaster.perner_karyawan.in_(delete_keys)))
            deleted = int(result.rowcount or 0)
            session.add(AuditLog(action="employee_master_delete", message=f"{deleted} data master karyawan dihapus."))
        saved = 0
        for record in records:
            perner = str(record.get("perner_karyawan") or "").strip()
            existing = session.execute(select(EmployeeMaster).where(EmployeeMaster.perner_karyawan == perner)).scalar_one_or_none()
            payload = {
                "perner_karyawan": perner,
                "nama_karyawan": str(record.get("nama_karyawan") or "").strip(),
                "jabatan_karyawan": str(record.get("jabatan_karyawan") or "").strip(),
                "departemen_seksi": str(record.get("departemen_seksi") or "").strip(),
                "status_karyawan": "Aktif",
                "source_batch_id": batch_id,
            }
            if existing:
                for key, value in payload.items():
                    setattr(existing, key, value)
            else:
                session.add(EmployeeMaster(**payload))
            saved += 1
        session.add(AuditLog(action="employee_master_sync", message=f"{saved} data master karyawan disimpan, {deleted} dihapus."))
        return {"saved": saved, "deleted": deleted}


def lookup_employee(perner: str | None = None, name: str | None = None, limit: int = 10) -> list[dict[str, object]]:
    df = get_employee_master(limit=None)
    if df.empty:
        return []
    if perner:
        key = str(perner).lower().strip()
        df = df[df["perner_karyawan"].astype(str).str.lower() == key]
    elif name:
        key = str(name).lower().strip()
        df = df[df["nama_karyawan"].astype(str).str.lower().str.contains(key, regex=False)]
    return df.head(limit).where(pd.notna(df), "").to_dict(orient="records")

DURATION_COLUMN_ALIASES = {
    "jenis_sanksi": {"jenis sanksi", "jenis_sanksi", "sanksi", "tipe sanksi", "kategori sanksi", "sanction type", "type"},
    "durasi_hari": {"durasi", "durasi hari", "durasi_hari", "masa berlaku", "masa_berlaku", "hari", "jumlah hari", "jumlah_hari", "days"},
}


def normalize_sanction_duration_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=SANCTION_DURATION_COLUMNS)
    rename_map = {}
    used_columns = set()
    for target, aliases in DURATION_COLUMN_ALIASES.items():
        original = _find_alias_column([column for column in df.columns if column not in used_columns], {target, *aliases})
        if original is not None:
            rename_map[original] = target
            used_columns.add(original)
    result = df.rename(columns=rename_map).copy()
    for column in SANCTION_DURATION_COLUMNS:
        if column not in result.columns:
            result[column] = ""
    result = result[SANCTION_DURATION_COLUMNS].fillna("").astype(str)
    for column in SANCTION_DURATION_COLUMNS:
        result[column] = result[column].str.strip()
    result["durasi_hari"] = pd.to_numeric(result["durasi_hari"].str.extract(r"(\d+)")[0], errors="coerce").fillna(0).astype(int)
    return result


def validate_sanction_duration_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict[str, object]]]:
    normalized = normalize_sanction_duration_dataframe(df)
    errors: list[dict[str, object]] = []
    if normalized.empty:
        return normalized, []
    duplicates = normalized[normalized["jenis_sanksi"].duplicated(keep=False) & (normalized["jenis_sanksi"] != "")]
    for index, row in normalized.iterrows():
        row_no = int(index) + 2
        if not str(row.get("jenis_sanksi", "")).strip():
            errors.append({"row": row_no, "column": "jenis_sanksi", "message": "JENIS SANKSI wajib diisi."})
        if int(row.get("durasi_hari") or 0) <= 0:
            errors.append({"row": row_no, "column": "durasi_hari", "message": "DURASI HARI wajib angka lebih dari 0."})
    for sanction_type in sorted(set(duplicates["jenis_sanksi"].tolist())):
        errors.append({"row": "-", "column": "jenis_sanksi", "message": f"Jenis sanksi duplikat di file: {sanction_type}"})
    return normalized, errors


def sanction_duration_to_dataframe(rows: list[SanctionDurationMaster]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "jenis_sanksi": row.jenis_sanksi,
            "durasi_hari": row.durasi_hari,
            "updated_at": row.updated_at,
        }
        for row in rows
    ])


def get_sanction_duration_master() -> pd.DataFrame:
    create_tables()
    with session_scope() as session:
        rows = session.execute(select(SanctionDurationMaster).order_by(SanctionDurationMaster.jenis_sanksi)).scalars().all()
    return sanction_duration_to_dataframe(rows)


def upsert_sanction_duration_master(df: pd.DataFrame, batch_id: int | None = None, mode: str = "update") -> int:
    normalized, errors = validate_sanction_duration_dataframe(df)
    if errors:
        raise ValueError("Master masa berlaku sanksi belum valid.")
    if normalized.empty:
        return 0
    records = normalized[SANCTION_DURATION_COLUMNS].where(pd.notna(normalized), "").to_dict(orient="records")
    create_tables()
    with session_scope() as session:
        if mode == "replace":
            session.execute(delete(SanctionDurationMaster))
        saved = 0
        for record in records:
            key = str(record.get("jenis_sanksi") or "").strip()
            existing = session.execute(select(SanctionDurationMaster).where(SanctionDurationMaster.jenis_sanksi == key)).scalar_one_or_none()
            payload = {
                "jenis_sanksi": key,
                "durasi_hari": int(record.get("durasi_hari") or 1),
                "keterangan": "",
                "source_batch_id": batch_id,
            }
            if existing:
                for item, value in payload.items():
                    setattr(existing, item, value)
            else:
                session.add(SanctionDurationMaster(**payload))
            saved += 1
        session.add(AuditLog(action="duration_master_upsert", message=f"{saved} data masa berlaku sanksi disimpan."))
        return saved


REPORT_STATUS_VALUES = {
    "laporan_masuk",
    "diterima_process",
    "pemanggilan_investigasi",
    "pemeriksaan",
    "sk_selesai",
}

REPORT_STATUS_LABELS = {
    "laporan_masuk": "laporan masuk",
    "diterima_process": "diterima process dalam verifikasi diterima",
    "pemanggilan_investigasi": "pemanggilan investigasi konfirmasi lapangan",
    "pemeriksaan": "pemeriksaan proses investigasi",
    "sk_selesai": "rekom diterbitkan sk diterbitkan selesai tuntas",
}


def _report_search_text(row: dict[str, object]) -> str:
    date_value = pd.to_datetime(row.get("tanggal_laporan"), errors="coerce")
    date_parts: list[str] = []
    if not pd.isna(date_value):
        month_names = ["jan", "feb", "mar", "apr", "mei", "jun", "jul", "agu", "sep", "okt", "nov", "des"]
        month = month_names[int(date_value.month) - 1]
        date_parts = [
            date_value.strftime("%Y-%m-%d"),
            date_value.strftime("%d-%m-%Y"),
            date_value.strftime("%d/%m/%Y"),
            date_value.strftime("%d %m %Y"),
            f"{date_value.day} {month} {date_value.year}",
            f"{date_value.day:02d} {month} {date_value.year}",
            str(date_value.year),
        ]
    return " ".join([str(row.get("departemen") or ""), *date_parts]).lower()


def _report_to_dict(row: ReportProgress) -> dict[str, object]:
    return {
        "id": row.id,
        "nomor_laporan": row.nomor_laporan,
        "departemen": row.departemen,
        "tanggal_laporan": row.tanggal_laporan.isoformat() if hasattr(row.tanggal_laporan, "isoformat") else str(row.tanggal_laporan),
        "jenis_laporan": row.jenis_laporan,
        "status_progress": row.status_progress,
        "keterangan": row.keterangan or "",
        "created_at": row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
        "updated_at": row.updated_at.isoformat() if hasattr(row.updated_at, "isoformat") else str(row.updated_at),
    }


def get_report_progress(search: str | None = None, status: str | None = None) -> list[dict[str, object]]:
    create_tables()
    with session_scope() as session:
        query = select(ReportProgress).order_by(ReportProgress.tanggal_laporan.desc(), ReportProgress.id.desc())
        if status and status != "all":
            query = query.where(ReportProgress.status_progress == status)
        rows = session.execute(query).scalars().all()
    records = [_report_to_dict(row) for row in rows]
    keyword = str(search or "").lower().strip()
    if keyword:
        terms = [term for term in keyword.split() if term]
        records = [
            row for row in records
            if all(term in _report_search_text(row) for term in terms)
        ]
    return records


def report_progress_stats(records: list[dict[str, object]]) -> dict[str, int]:
    stats = {status: 0 for status in REPORT_STATUS_VALUES}
    for record in records:
        status = str(record.get("status_progress") or "laporan_masuk")
        if status in stats:
            stats[status] += 1
    stats["total"] = len(records)
    return stats


def generate_report_number(session) -> str:
    year = pd.Timestamp.now().year
    prefix = f"RPT/{year}/"
    count = session.execute(select(ReportProgress.id).where(ReportProgress.nomor_laporan.like(f"{prefix}%"))).all()
    return f"{prefix}{len(count) + 1:04d}"


def create_report_progress(payload: dict[str, object]) -> dict[str, object]:
    create_tables()
    departemen = str(payload.get("departemen") or "").strip()
    tanggal = pd.to_datetime(payload.get("tanggal_laporan"), errors="coerce")
    jenis = str(payload.get("jenis_laporan") or "").strip()
    if not departemen or pd.isna(tanggal) or not jenis:
        raise ValueError("Departemen, tanggal laporan, dan jenis laporan wajib diisi.")
    status = str(payload.get("status_progress") or "laporan_masuk")
    if status not in REPORT_STATUS_VALUES:
        status = "laporan_masuk"
    with session_scope() as session:
        row = ReportProgress(
            nomor_laporan=str(payload.get("nomor_laporan") or "").strip() or generate_report_number(session),
            departemen=departemen,
            tanggal_laporan=tanggal.date(),
            jenis_laporan=jenis,
            status_progress=status,
            keterangan=str(payload.get("keterangan") or "").strip() or None,
        )
        session.add(row)
        session.flush()
        session.add(AuditLog(action="report_progress_create", message=f"Laporan {row.nomor_laporan} dibuat."))
        return _report_to_dict(row)


def update_report_progress_status(report_id: int, status: str) -> dict[str, object]:
    create_tables()
    if status not in REPORT_STATUS_VALUES:
        raise ValueError("Status progress tidak valid.")
    with session_scope() as session:
        row = session.get(ReportProgress, int(report_id))
        if row is None:
            raise ValueError("Laporan tidak ditemukan.")
        old_status = row.status_progress
        row.status_progress = status
        session.add(AuditLog(action="report_progress_status", message=f"Status laporan {row.nomor_laporan} berubah dari {old_status} ke {status}."))
        session.flush()
        return _report_to_dict(row)


def update_report_progress_note(report_id: int, keterangan: str) -> dict[str, object]:
    create_tables()
    with session_scope() as session:
        row = session.get(ReportProgress, int(report_id))
        if row is None:
            raise ValueError("Laporan tidak ditemukan.")
        row.keterangan = str(keterangan or "").strip() or None
        session.add(AuditLog(action="report_progress_note", message=f"Keterangan laporan {row.nomor_laporan} diperbarui."))
        session.flush()
        return _report_to_dict(row)


def delete_report_progress(report_id: int) -> None:
    create_tables()
    with session_scope() as session:
        row = session.get(ReportProgress, int(report_id))
        if row is None:
            raise ValueError("Laporan tidak ditemukan.")
        report_number = row.nomor_laporan
        session.delete(row)
        session.add(AuditLog(action="report_progress_delete", message=f"Laporan {report_number} dihapus."))

