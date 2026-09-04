import pandas as pd

from services.validator import REQUIRED_COLUMNS, normalize_header, validate_structure, validate_transformed_data


def test_normalize_header_tolerates_case_spaces_and_line_breaks():
    assert normalize_header("  tanggal  mulai\n sanksi ") == "TANGGAL MULAI SANKSI"


def test_validate_structure_detects_required_columns():
    df = pd.DataFrame(columns=[column.lower() for column in REQUIRED_COLUMNS])

    result = validate_structure(df)

    assert result.is_valid
    assert not result.missing_columns


def test_validate_structure_reports_missing_columns():
    df = pd.DataFrame(columns=["NOMOR SURAT SANKSI"])

    result = validate_structure(df)

    assert not result.is_valid
    assert "TANGGAL MULAI SANKSI" in result.missing_columns


def test_validate_transformed_data_rejects_end_date_before_start():
    df = pd.DataFrame(
        {
            "nomor_baris_excel": [2],
            "nomor_surat_sanksi": ["S-001"],
            "tanggal_mulai_sanksi": [pd.Timestamp("2026-08-10").date()],
            "tanggal_berakhir_sanksi": [pd.Timestamp("2026-08-09").date()],
            "perner_karyawan": ["00123"],
            "nama_karyawan": ["Budi"],
            "departemen_seksi": ["Produksi"],
            "jenis_sanksi": ["ST1"],
        }
    )

    result = validate_transformed_data(df)

    assert result.valid_df.empty
    assert "Tanggal berakhir" in result.errors_df.loc[0, "jenis_kesalahan"]
