from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
import re

import pandas as pd


REQUIRED_COLUMNS = [
    "NOMOR SURAT SANKSI",
    "TANGGAL MULAI SANKSI",
    "PERNER KARYAWAN",
    "NAMA KARYAWAN",
    "JABATAN KARYAWAN",
    "DEPARTEMEN/SEKSI",
    "JENIS SANKSI",
    "URAIAN PELANGGARAN",
]

OPTIONAL_COLUMNS = [
    "TANGGAL BERAKHIR SANKSI",
]

CANONICAL_COLUMNS = {
    "NOMOR SURAT SANKSI": "nomor_surat_sanksi",
    "TANGGAL MULAI SANKSI": "tanggal_mulai_sanksi",
    "TANGGAL BERAKHIR SANKSI": "tanggal_berakhir_sanksi",
    "PERNER KARYAWAN": "perner_karyawan",
    "NAMA KARYAWAN": "nama_karyawan",
    "JABATAN KARYAWAN": "jabatan_karyawan",
    "DEPARTEMEN/SEKSI": "departemen_seksi",
    "JENIS SANKSI": "jenis_sanksi",
    "URAIAN PELANGGARAN": "uraian_pelanggaran",
}

HEADER_ALIASES = {
    "NOMOR SURAT SANKSI": {
        "nomor surat sanksi",
        "no surat sanksi",
        "nomor surat",
        "no surat",
        "surat sanksi",
        "nomor sk",
        "no sk",
        "nomor sanksi",
    },
    "TANGGAL MULAI SANKSI": {
        "tanggal mulai sanksi",
        "tgl mulai sanksi",
        "tanggal mulai",
        "tgl mulai",
        "mulai sanksi",
        "tanggal sanksi",
        "tgl sanksi",
        "start date",
        "effective date",
    },
    "TANGGAL BERAKHIR SANKSI": {
        "tanggal berakhir sanksi",
        "tgl berakhir sanksi",
        "tanggal berakhir",
        "tgl berakhir",
        "akhir sanksi",
        "masa berlaku sampai",
        "expired date",
        "end date",
    },
    "PERNER KARYAWAN": {
        "perner karyawan",
        "perner",
        "nik",
        "id karyawan",
        "employee id",
        "employee_id",
        "personnel number",
        "nrp",
    },
    "NAMA KARYAWAN": {
        "nama karyawan",
        "nama",
        "employee name",
        "full name",
        "nama lengkap",
        "karyawan",
    },
    "JABATAN KARYAWAN": {
        "jabatan karyawan",
        "jabatan",
        "posisi",
        "position",
        "job title",
        "title",
    },
    "DEPARTEMEN/SEKSI": {
        "departemen/seksi",
        "departemen",
        "department",
        "dept",
        "seksi",
        "unit",
        "bagian",
        "divisi",
    },
    "JENIS SANKSI": {
        "jenis sanksi",
        "sanksi",
        "tipe sanksi",
        "kategori sanksi",
        "sanction type",
        "type",
    },
    "URAIAN PELANGGARAN": {
        "uraian pelanggaran",
        "pelanggaran",
        "keterangan pelanggaran",
        "deskripsi pelanggaran",
        "uraian",
        "kronologi",
        "kasus",
    },
}


@dataclass(frozen=True)
class StructureValidationResult:
    is_valid: bool
    found_columns: list[str]
    missing_columns: list[str]
    column_map: dict[str, str]


@dataclass(frozen=True)
class DataValidationResult:
    valid_df: pd.DataFrame
    invalid_df: pd.DataFrame
    errors_df: pd.DataFrame
    duplicate_df: pd.DataFrame


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    errors: list[str]


def normalize_header(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\n", " ").replace("\r", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text.strip())
    text = text.upper()
    text = text.replace(" / ", "/").replace("/ ", "/").replace(" /", "/")
    return text


def header_match_key(value: object) -> str:
    text = normalize_header(value).lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def header_alias_keys(required: str) -> set[str]:
    aliases = {required, CANONICAL_COLUMNS[required], *HEADER_ALIASES.get(required, set())}
    return {header_match_key(alias) for alias in aliases if header_match_key(alias)}


def safe_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def find_matching_header(required: str, headers: list[object]) -> object | None:
    keyed_headers = [(header_match_key(header), header) for header in headers]
    alias_keys = header_alias_keys(required)

    for key, header in keyed_headers:
        if key in alias_keys:
            return header

    for key, header in keyed_headers:
        if not key:
            continue
        if any(len(alias) >= 4 and (alias in key or key in alias) for alias in alias_keys):
            return header

    best_header = None
    best_score = 0.0
    for key, header in keyed_headers:
        for alias in alias_keys:
            if not key or not alias:
                continue
            score = SequenceMatcher(None, key, alias).ratio()
            if score > best_score:
                best_score = score
                best_header = header
    return best_header if best_score >= 0.86 else None


def normalize_dataframe_headers(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
    rename_map = {}
    used_originals = set()
    for required in [*REQUIRED_COLUMNS, *OPTIONAL_COLUMNS]:
        original = find_matching_header(required, [column for column in df.columns if column not in used_originals])
        if original is not None:
            rename_map[original] = CANONICAL_COLUMNS[required]
            used_originals.add(original)

    normalized = df.rename(columns=rename_map).copy()
    return normalized, rename_map


def validate_structure(df: pd.DataFrame) -> StructureValidationResult:
    found = []
    missing = []
    column_map = {}
    used_originals = set()

    for required in REQUIRED_COLUMNS:
        original = find_matching_header(required, [column for column in df.columns if column not in used_originals])
        if original is not None:
            found.append(required)
            column_map[original] = CANONICAL_COLUMNS[required]
            used_originals.add(original)
        else:
            missing.append(required)

    return StructureValidationResult(
        is_valid=not missing,
        found_columns=found,
        missing_columns=missing,
        column_map=column_map,
    )


def validate_sanction_data(df: pd.DataFrame) -> ValidationResult:
    structure = validate_structure(df)
    return ValidationResult(is_valid=structure.is_valid, errors=structure.missing_columns)


def validate_transformed_data(df: pd.DataFrame) -> DataValidationResult:
    df = df.copy()
    errors: list[dict[str, object]] = []
    invalid_indexes: set[int] = set()

    required_rules = {
        "nomor_surat_sanksi": "Isi nomor surat sanksi.",
        "tanggal_mulai_sanksi": "Perbaiki tanggal mulai sanksi.",
        "perner_karyawan": "Isi PERNER karyawan sebagai teks.",
        "nama_karyawan": "Isi nama karyawan.",
        "departemen_seksi": "Isi departemen/seksi.",
        "jenis_sanksi": "Isi jenis sanksi.",
    }

    for column in required_rules:
        if column not in df.columns:
            df[column] = pd.NA

    if df.empty:
        empty_errors = pd.DataFrame(
            columns=["nomor_baris_excel", "nama_kolom", "nilai_asli", "jenis_kesalahan", "saran_perbaikan"]
        )
        return DataValidationResult(valid_df=df.copy(), invalid_df=df.copy(), errors_df=empty_errors, duplicate_df=df.copy())

    for idx, row in df.iterrows():
        excel_row = int(row.get("nomor_baris_excel", idx + 2))
        for column, suggestion in required_rules.items():
            value = row.get(column)
            if pd.isna(value) or str(value).strip() == "":
                invalid_indexes.add(idx)
                errors.append(
                    {
                        "nomor_baris_excel": excel_row,
                        "nama_kolom": column,
                        "nilai_asli": value,
                        "jenis_kesalahan": "Nilai wajib kosong atau tidak terbaca",
                        "saran_perbaikan": suggestion,
                    }
                )

        start = row.get("tanggal_mulai_sanksi")
        end = row.get("tanggal_berakhir_sanksi")
        sanction_type = safe_text(row.get("jenis_sanksi")).upper()
        open_ended = any(keyword in sanction_type for keyword in ("PHK", "DISKUALIFIKASI", "MENGUNDURKAN DIRI", "MENGUNDUR"))
        if not open_ended and (pd.isna(end) or str(end).strip() == ""):
            invalid_indexes.add(idx)
            errors.append(
                {
                    "nomor_baris_excel": excel_row,
                    "nama_kolom": "tanggal_berakhir_sanksi",
                    "nilai_asli": end,
                    "jenis_kesalahan": "Tanggal berakhir kosong atau tidak terbaca",
                    "saran_perbaikan": "Tanggal berakhir otomatis untuk teguran/peringatan. Periksa jenis sanksi dan tanggal mulai.",
                }
            )
        if pd.notna(start) and pd.notna(end) and end < start:
            invalid_indexes.add(idx)
            errors.append(
                {
                    "nomor_baris_excel": excel_row,
                    "nama_kolom": "tanggal_berakhir_sanksi",
                    "nilai_asli": end,
                    "jenis_kesalahan": "Tanggal berakhir lebih awal dari tanggal mulai",
                    "saran_perbaikan": "Pastikan tanggal berakhir sama dengan atau setelah tanggal mulai.",
                }
            )

    duplicate_mask = df["nomor_surat_sanksi"].notna() & df.duplicated("nomor_surat_sanksi", keep=False)
    duplicate_df = df.loc[duplicate_mask].copy()
    for idx, row in duplicate_df.iterrows():
        invalid_indexes.add(idx)
        errors.append(
            {
                "nomor_baris_excel": int(row.get("nomor_baris_excel", idx + 2)),
                "nama_kolom": "nomor_surat_sanksi",
                "nilai_asli": row.get("nomor_surat_sanksi"),
                "jenis_kesalahan": "Duplikat nomor surat dalam file",
                "saran_perbaikan": "Pilih abaikan duplikat, ganti data lama, atau batalkan upload.",
            }
        )

    invalid_df = df.loc[sorted(invalid_indexes)].copy() if invalid_indexes else df.iloc[0:0].copy()
    valid_df = df.drop(index=sorted(invalid_indexes)).copy() if invalid_indexes else df.copy()
    errors_df = pd.DataFrame(
        errors,
        columns=["nomor_baris_excel", "nama_kolom", "nilai_asli", "jenis_kesalahan", "saran_perbaikan"],
    )
    return DataValidationResult(valid_df=valid_df, invalid_df=invalid_df, errors_df=errors_df, duplicate_df=duplicate_df)

