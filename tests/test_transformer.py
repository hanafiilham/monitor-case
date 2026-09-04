from datetime import date

import pandas as pd

from services.transformer import calculate_duration_days, calculate_status, parse_date_series, transform_sanction_data


def test_parse_date_series_uses_day_first():
    result = parse_date_series(pd.Series(["04/08/2026", "2026-08-05"]))

    assert result.iloc[0] == date(2026, 8, 4)
    assert result.iloc[1] == date(2026, 8, 5)


def test_calculate_duration_days_is_inclusive():
    assert calculate_duration_days(date(2026, 8, 1), date(2026, 8, 1)) == 1
    assert calculate_duration_days(date(2026, 8, 1), date(2026, 8, 3)) == 3


def test_calculate_status_not_started_active_ended():
    today = date(2026, 8, 4)

    assert calculate_status(date(2026, 8, 5), date(2026, 8, 6), today) == "Belum Dimulai"
    assert calculate_status(date(2026, 8, 1), date(2026, 8, 4), today) == "Aktif"
    assert calculate_status(date(2026, 8, 1), date(2026, 8, 3), today) == "Berakhir"


def test_transform_sanction_data_preserves_perner_as_string_and_period():
    df = pd.DataFrame(
        {
            " NOMOR  SURAT SANKSI ": ["S-001"],
            "TANGGAL MULAI SANKSI": ["01/08/2026"],
            "TANGGAL BERAKHIR SANKSI": ["03/08/2026"],
            "PERNER KARYAWAN": ["00123"],
            "NAMA KARYAWAN": [" Budi Santoso "],
            "JABATAN KARYAWAN": ["Operator"],
            "DEPARTEMEN/SEKSI": ["produksi"],
            "JENIS SANKSI": ["st 1"],
            "URAIAN PELANGGARAN": ["Terlambat"],
        }
    )

    result = transform_sanction_data(df, today=date(2026, 8, 2))

    assert result.loc[0, "perner_karyawan"] == "00123"
    assert result.loc[0, "durasi_sanksi_hari"] == 3
    assert result.loc[0, "status_sanksi"] == "Aktif"
    assert result.loc[0, "periode_sanksi"] == "2026-08"

def test_transform_sanction_data_fills_single_day_sanction_end_date():
    df = pd.DataFrame(
        {
            "NOMOR SURAT SANKSI": ["S-002", "S-003"],
            "TANGGAL MULAI SANKSI": ["2026-08-05 00:00:00", "06/08/2026"],
            "TANGGAL BERAKHIR SANKSI": [pd.NA, pd.NA],
            "PERNER KARYAWAN": ["10001", "10002"],
            "NAMA KARYAWAN": ["Ayu", "Budi"],
            "JABATAN KARYAWAN": ["Staff", "Operator"],
            "DEPARTEMEN/SEKSI": ["HRD", "Produksi"],
            "JENIS SANKSI": ["PHK", "Surat Pernyataan"],
            "URAIAN PELANGGARAN": ["Mengundurkan diri", "Pernyataan tertulis"],
        }
    )

    result = transform_sanction_data(df, today=date(2026, 8, 7))

    assert pd.isna(result.loc[0, "tanggal_berakhir_sanksi"])
    assert result.loc[1, "tanggal_berakhir_sanksi"] == date(2026, 8, 6)
    assert pd.isna(result.loc[0, "durasi_sanksi_hari"])
    assert result.loc[1, "durasi_sanksi_hari"] == 1
    assert result.loc[0, "periode_sanksi"] == "2026-08"


def test_transform_sanction_data_generates_end_date_for_duration_sanction():
    df = pd.DataFrame(
        {
            "NOMOR SURAT SANKSI": ["S-004"],
            "TANGGAL MULAI SANKSI": ["01/08/2026"],
            "TANGGAL BERAKHIR SANKSI": [pd.NA],
            "PERNER KARYAWAN": ["10003"],
            "NAMA KARYAWAN": ["Citra"],
            "JABATAN KARYAWAN": ["Staff"],
            "DEPARTEMEN/SEKSI": ["Finance"],
            "JENIS SANKSI": ["ST1"],
            "URAIAN PELANGGARAN": ["Terlambat"],
        }
    )

    result = transform_sanction_data(df, today=date(2026, 8, 2))

    assert result.loc[0, "tanggal_berakhir_sanksi"] == date(2026, 10, 31)
    assert result.loc[0, "durasi_sanksi_hari"] == 92


def test_transform_sanction_data_drops_blank_excel_tail_rows():
    df = pd.DataFrame(
        {
            "NOMOR SURAT SANKSI": ["S-005", ""],
            "TANGGAL MULAI SANKSI": ["01/08/2026", ""],
            "TANGGAL BERAKHIR SANKSI": ["", ""],
            "PERNER KARYAWAN": ["10004", ""],
            "NAMA KARYAWAN": ["Dewi", ""],
            "JABATAN KARYAWAN": ["Staff", ""],
            "DEPARTEMEN/SEKSI": ["Finance", ""],
            "JENIS SANKSI": ["SP1", ""],
            "URAIAN PELANGGARAN": ["Tidak disiplin", ""],
        }
    )

    result = transform_sanction_data(df, today=date(2026, 8, 2))

    assert len(result) == 1
    assert result.iloc[0]["nomor_baris_excel"] == 2
    assert result.iloc[0]["tanggal_berakhir_sanksi"] == date(2027, 1, 31)


def test_transform_sanction_data_repairs_end_date_before_start():
    df = pd.DataFrame(
        {
            "NOMOR SURAT SANKSI": ["S-006"],
            "TANGGAL MULAI SANKSI": ["01/08/2026"],
            "TANGGAL BERAKHIR SANKSI": ["01/07/2026"],
            "PERNER KARYAWAN": ["10005"],
            "NAMA KARYAWAN": ["Eka"],
            "JABATAN KARYAWAN": ["Staff"],
            "DEPARTEMEN/SEKSI": ["Finance"],
            "JENIS SANKSI": ["ST1"],
            "URAIAN PELANGGARAN": ["Terlambat"],
        }
    )

    result = transform_sanction_data(df, today=date(2026, 8, 2))

    assert result.loc[0, "tanggal_berakhir_sanksi"] == date(2026, 10, 31)

