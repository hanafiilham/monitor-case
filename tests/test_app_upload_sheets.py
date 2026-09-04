from openpyxl import Workbook
from pathlib import Path

from app import _is_sanction_detail_sheet, _scan_upload_sheets


def test_sanction_detail_sheet_name_pattern():
    assert _is_sanction_detail_sheet("Rekap sanksi Jan - Des 2026")
    assert _is_sanction_detail_sheet("REKAP SANKSI JAN - DES 2025")
    assert _is_sanction_detail_sheet("Rekap sanksi Jan – Des 2024")


def test_non_detail_sheet_names_are_ignored():
    assert not _is_sanction_detail_sheet("RESUME 2026")
    assert not _is_sanction_detail_sheet("Sheet1")
    assert not _is_sanction_detail_sheet("Rekap sanksi 2026")


def test_ignored_sheet_does_not_generate_invalid_detail():
    path = Path("data/sample/_test_ignored_sheet.xlsx")
    path.parent.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    workbook.active.title = "Sheet1"
    workbook.save(path)
    workbook.close()

    try:
        details, preview = _scan_upload_sheets(path)
    finally:
        try:
            path.unlink(missing_ok=True)
        except PermissionError:
            pass

    assert preview.empty
    assert details[0]["ignored"] is True
    assert details[0]["invalid"] == 0
    assert details[0]["invalid_details"] == []
