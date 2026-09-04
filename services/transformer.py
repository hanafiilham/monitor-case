from __future__ import annotations

from datetime import date, timedelta
import re

import pandas as pd

from services.validator import CANONICAL_COLUMNS, OPTIONAL_COLUMNS, REQUIRED_COLUMNS, normalize_dataframe_headers


STATUS_NOT_STARTED = "Belum Dimulai"
STATUS_ACTIVE = "Aktif"
STATUS_ENDED = "Berakhir"
OPEN_ENDED_SANCTION_KEYWORDS = (
    "PHK",
    "DISKUALIFIKASI",
    "MENGUNDURKAN DIRI",
    "MENGUNDUR",
)

SANCTION_DURATION_DAY_RULES = (
    (re.compile(r"surat\s*pernyataan", re.IGNORECASE), 1),
)

SANCTION_DURATION_MONTH_RULES = (
    (re.compile(r"\bsp\s*[- ]?i{0,3}\b|\bsp\s*[- ]?[123]\b|peringatan", re.IGNORECASE), 6),
    (re.compile(r"\bst\s*[- ]?i{0,3}\b|\bst\s*[- ]?[123]\b|teguran", re.IGNORECASE), 3),
)


def clean_text_series(series: pd.Series) -> pd.Series:
    return (
        series.astype("string")
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
        .replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})
    )


def standardize_department(value: object) -> object:
    if pd.isna(value):
        return pd.NA
    text = re.sub(r"\s+", " ", str(value).strip())
    if len(text) <= 4:
        return text.upper()
    normalized = text.title()

    def uppercase_roman(match: re.Match[str]) -> str:
        prefix = match.group(1)
        roman = match.group(2).upper()
        return f"{prefix}{roman}"

    normalized = re.sub(r"(\bD\.)([ivxlcdm]+)\b", uppercase_roman, normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"(\bDistrict\s+)([ivxlcdm]+)\b", uppercase_roman, normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"(\bDistrik\s+)([ivxlcdm]+)\b", uppercase_roman, normalized, flags=re.IGNORECASE)
    return normalized


def standardize_sanction_type(value: object) -> object:
    if pd.isna(value):
        return pd.NA
    text = re.sub(r"\s+", " ", str(value).strip()).upper()
    if any(keyword in text for keyword in OPEN_ENDED_SANCTION_KEYWORDS):
        return "PHK"
    replacements = {
        "SURAT PERNYATAAN": "Surat Pernyataan",
        "ST 1": "ST1",
        "ST 2": "ST2",
        "ST 3": "ST3",
        "SP 1": "SP1",
        "SP 2": "SP2",
        "SP 3": "SP3",
        "PHK": "PHK",
    }
    return replacements.get(text, text)


def is_open_ended_sanction(value: object) -> bool:
    if pd.isna(value):
        return False
    text = re.sub(r"\s+", " ", str(value).strip()).upper()
    return any(keyword in text for keyword in OPEN_ENDED_SANCTION_KEYWORDS)



def sanction_duration_months(value: object) -> int | None:
    if pd.isna(value):
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    if not text:
        return None
    for pattern, months in SANCTION_DURATION_MONTH_RULES:
        if pattern.search(text):
            return months
    return None


def sanction_duration_days(value: object) -> int | None:
    if pd.isna(value):
        return None
    text = re.sub(r"\s+", " ", str(value).strip())
    if not text:
        return None
    for pattern, days in SANCTION_DURATION_DAY_RULES:
        if pattern.search(text):
            return days
    return None


def calculate_end_date_by_type(start: object, sanction_type: object) -> date | None:
    start_date = normalize_date_value(start)
    if start_date is None or is_open_ended_sanction(sanction_type):
        return None
    months = sanction_duration_months(sanction_type)
    if months is not None:
        return (pd.Timestamp(start_date) + pd.DateOffset(months=int(months)) - timedelta(days=1)).date()
    days = sanction_duration_days(sanction_type)
    if days is not None:
        return (pd.Timestamp(start_date) + timedelta(days=int(days) - 1)).date()
    return None

def parse_date_series(series: pd.Series) -> pd.Series:
    text_values = series.astype("string").str.strip()
    iso_mask = text_values.str.match(r"^\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$", na=False)
    parsed = pd.to_datetime(series.where(iso_mask), errors="coerce", dayfirst=False)
    non_iso = ~iso_mask
    parsed.loc[non_iso] = pd.to_datetime(series[non_iso], errors="coerce", dayfirst=True)

    unresolved = parsed.isna() & series.notna() & (text_values != "")
    if unresolved.any():
        numeric = pd.to_numeric(series[unresolved], errors="coerce")
        excel_dates = pd.to_datetime(numeric, unit="D", origin="1899-12-30", errors="coerce")
        parsed.loc[unresolved] = excel_dates
    return parsed.dt.date


def normalize_date_value(value: object) -> date | None:
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, date):
        return value
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def calculate_duration_days(start: date, end: date) -> int | None:
    start_date = normalize_date_value(start)
    end_date = normalize_date_value(end)
    if start_date is None or end_date is None:
        return None
    return (end_date - start_date).days + 1


def calculate_status(start: date, end: date | None, today: date | None = None) -> str | None:
    start_date = normalize_date_value(start)
    end_date = normalize_date_value(end)
    if start_date is None:
        return None
    current = today or date.today()
    if end_date is None:
        return STATUS_NOT_STARTED if current < start_date else STATUS_ACTIVE
    if current < start_date:
        return STATUS_NOT_STARTED
    if start_date <= current <= end_date:
        return STATUS_ACTIVE
    return STATUS_ENDED


def transform_sanction_data(df: pd.DataFrame, today: date | None = None) -> pd.DataFrame:
    transformed, _ = normalize_dataframe_headers(df)
    selected_columns = [CANONICAL_COLUMNS[column] for column in [*REQUIRED_COLUMNS, *OPTIONAL_COLUMNS] if CANONICAL_COLUMNS[column] in transformed.columns]
    transformed = transformed[selected_columns].copy()
    if "tanggal_berakhir_sanksi" not in transformed.columns:
        transformed["tanggal_berakhir_sanksi"] = pd.NA
    transformed.insert(0, "nomor_baris_excel", transformed.index + 2)

    for column in transformed.columns:
        if column not in {"nomor_baris_excel"}:
            transformed[column] = clean_text_series(transformed[column])

    input_columns = [column for column in transformed.columns if column != "nomor_baris_excel"]
    if input_columns:
        meaningful_columns = [
            column
            for column in input_columns
            if column not in {"tanggal_berakhir_sanksi"}
        ] or input_columns
        blank_input_mask = transformed[meaningful_columns].apply(
            lambda row: all(pd.isna(value) or str(value).strip() == "" for value in row),
            axis=1,
        )
        transformed = transformed.loc[~blank_input_mask].copy()

    for column in ["nomor_surat_sanksi", "perner_karyawan"]:
        if column in transformed.columns:
            transformed[column] = transformed[column].astype("string").str.replace(r"\.0$", "", regex=True).str.strip()

    if "departemen_seksi" in transformed.columns:
        transformed["departemen_seksi"] = transformed["departemen_seksi"].map(standardize_department)
    if "jenis_sanksi" in transformed.columns:
        transformed["jenis_sanksi"] = transformed["jenis_sanksi"].map(standardize_sanction_type)

    for column in ["tanggal_mulai_sanksi", "tanggal_berakhir_sanksi"]:
        if column in transformed.columns:
            transformed[column] = parse_date_series(transformed[column])

    if {"tanggal_mulai_sanksi", "tanggal_berakhir_sanksi", "jenis_sanksi"}.issubset(transformed.columns):
        transformed["tanggal_berakhir_sanksi"] = transformed["tanggal_berakhir_sanksi"].astype("object")
        start_values = transformed["tanggal_mulai_sanksi"]
        end_values = transformed["tanggal_berakhir_sanksi"]
        invalid_end_mask = pd.Series(
            [
                bool(pd.notna(start) and pd.notna(end) and normalize_date_value(end) is not None and normalize_date_value(start) is not None and normalize_date_value(end) < normalize_date_value(start))
                for start, end in zip(start_values, end_values)
            ],
            index=transformed.index,
        )
        auto_end_mask = start_values.notna() & (
            end_values.isna()
            | invalid_end_mask
        )
        transformed.loc[auto_end_mask, "tanggal_berakhir_sanksi"] = [
            calculate_end_date_by_type(start, sanction_type)
            for start, sanction_type in zip(
                transformed.loc[auto_end_mask, "tanggal_mulai_sanksi"],
                transformed.loc[auto_end_mask, "jenis_sanksi"],
            )
        ]

    for column in ["tanggal_mulai_sanksi", "tanggal_berakhir_sanksi"]:
        if column in transformed.columns:
            transformed[column] = transformed[column].map(normalize_date_value)

    start = transformed.get("tanggal_mulai_sanksi")
    end = transformed.get("tanggal_berakhir_sanksi")
    if start is not None and end is not None:
        transformed["durasi_sanksi_hari"] = [calculate_duration_days(s, e) for s, e in zip(start, end)]
        transformed["status_sanksi"] = [calculate_status(s, e, today=today) for s, e in zip(start, end)]
        start_dt = pd.to_datetime(start, errors="coerce")
        transformed["bulan_sanksi"] = start_dt.dt.month.astype("Int64")
        transformed["tahun_sanksi"] = start_dt.dt.year.astype("Int64")
        transformed["periode_sanksi"] = start_dt.dt.strftime("%Y-%m")

    transformed = transformed.dropna(how="all", subset=[column for column in transformed.columns if column != "nomor_baris_excel"])
    return transformed




