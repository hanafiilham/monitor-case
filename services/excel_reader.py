from __future__ import annotations

from pathlib import Path

import pandas as pd


class ExcelReadError(RuntimeError):
    pass


def list_sheets(path: str | Path) -> list[str]:
    try:
        excel = pd.ExcelFile(path)
        return excel.sheet_names
    except Exception as exc:
        raise ExcelReadError("File Excel tidak dapat dibaca. Pastikan file tidak rusak dan formatnya didukung: .xlsx, .xls, .xlsm, .xlsb, .xltx, atau .xltm.") from exc


def read_excel_file(path: str | Path, sheet_name: str | int = 0, nrows: int | None = None) -> pd.DataFrame:
    try:
        return pd.read_excel(path, sheet_name=sheet_name, dtype=str, nrows=nrows, keep_default_na=False)
    except Exception as exc:
        raise ExcelReadError("Sheet Excel tidak dapat dibaca. Periksa nama sheet dan struktur file.") from exc


def read_excel_preview(path: str | Path, sheet_name: str | int = 0, rows: int = 20) -> pd.DataFrame:
    return read_excel_file(path, sheet_name=sheet_name, nrows=rows)
