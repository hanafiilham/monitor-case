import pandas as pd

from services.calculations import distinct_count, repeat_offenders, sanctions_per_month


def test_distinct_count_nomor_surat_ignores_duplicates():
    df = pd.DataFrame({"nomor_surat_sanksi": ["A", "A", "B"]})

    assert distinct_count(df) == 2


def test_sanctions_per_month_keeps_all_12_months():
    df = pd.DataFrame({"bulan_sanksi": [1, 1, 3], "nomor_surat_sanksi": ["A", "A", "B"]})

    result = sanctions_per_month(df)

    assert len(result) == 12
    assert result.loc[result["bulan_sanksi"] == 1, "jumlah"].iloc[0] == 1
    assert result.loc[result["bulan_sanksi"] == 2, "jumlah"].iloc[0] == 0


def test_repeat_offenders_only_returns_more_than_one_sanction():
    df = pd.DataFrame(
        {
            "perner_karyawan": ["1", "1", "2"],
            "nama_karyawan": ["Budi", "Budi", "Agus"],
            "nomor_surat_sanksi": ["A", "B", "C"],
        }
    )

    result = repeat_offenders(df)

    assert len(result) == 1
    assert result.loc[0, "perner_karyawan"] == "1"
    assert result.loc[0, "jumlah"] == 2

def test_department_chart_excludes_blank_and_other_bucket():
    import pandas as pd
    from services.calculations import sanctions_by_department

    df = pd.DataFrame(
        {
            "nomor_surat_sanksi": [f"S-{i}" for i in range(1, 11)],
            "departemen_seksi": ["Produksi", "", None, "Finance", "HRD", "Security", "Logistik", "QA", "IT", "Maintenance"],
        }
    )

    result = sanctions_by_department(df, limit=4)

    assert "" not in result["departemen_seksi"].astype(str).tolist()
    assert "Lainnya" not in result["departemen_seksi"].astype(str).tolist()
    assert len(result) == 4

def test_violations_use_raw_uraian_text_without_keyword_mapping():
    import pandas as pd
    from services.calculations import violations_by_category

    df = pd.DataFrame(
        {
            "nomor_surat_sanksi": ["S-1", "S-2", "S-3"],
            "uraian_pelanggaran": ["Tidak memakai APD", "Tidak memakai APD", "Terlambat masuk kerja"],
        }
    )

    result = violations_by_category(df)

    assert result.iloc[0]["uraian_pelanggaran"] == "Tidak memakai APD"
    assert result.iloc[0]["jumlah"] == 2
    assert "Keselamatan Kerja" not in result["uraian_pelanggaran"].tolist()

