from __future__ import annotations

import re

import pandas as pd


MONTH_LABELS = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "Mei",
    6: "Jun",
    7: "Jul",
    8: "Agu",
    9: "Sep",
    10: "Okt",
    11: "Nov",
    12: "Des",
}



def clean_category_series(series: pd.Series, empty_label: str | None = None) -> pd.Series:
    cleaned = series.astype("string").str.replace(r"\s+", " ", regex=True).str.strip()
    cleaned = cleaned.replace({"": pd.NA, "nan": pd.NA, "None": pd.NA, "<NA>": pd.NA})
    if empty_label is not None:
        cleaned = cleaned.fillna(empty_label)
    return cleaned


def grouped_distinct_by_category(df: pd.DataFrame, category_column: str, output_column: str, limit: int | None = None) -> pd.DataFrame:
    if df.empty or category_column not in df.columns:
        return pd.DataFrame(columns=[output_column, "jumlah"])
    prepared = df.copy()
    prepared[output_column] = clean_category_series(prepared[category_column])
    prepared = prepared[prepared[output_column].notna()]
    if prepared.empty:
        return pd.DataFrame(columns=[output_column, "jumlah"])
    result = (
        prepared.groupby(output_column)["nomor_surat_sanksi"]
        .nunique()
        .reset_index(name="jumlah")
        .sort_values("jumlah", ascending=False)
    )
    return result if limit is None else result.head(limit)
def distinct_count(df: pd.DataFrame, column: str = "nomor_surat_sanksi") -> int:
    if df.empty or column not in df.columns:
        return 0
    return int(df[column].dropna().astype(str).nunique())


def sanctions_per_month(df: pd.DataFrame) -> pd.DataFrame:
    base = pd.DataFrame({"bulan_sanksi": list(range(1, 13)), "bulan": [MONTH_LABELS[i] for i in range(1, 13)]})
    if df.empty:
        base["jumlah"] = 0
        return base
    grouped = df.groupby("bulan_sanksi")["nomor_surat_sanksi"].nunique().reset_index(name="jumlah")
    result = base.merge(grouped, on="bulan_sanksi", how="left")
    result["jumlah"] = result["jumlah"].fillna(0).astype(int)
    return result


def sanctions_by_department(df: pd.DataFrame, limit: int | None = None) -> pd.DataFrame:
    return grouped_distinct_by_category(df, "departemen_seksi", "departemen_seksi", limit)

def sanctions_by_type(df: pd.DataFrame) -> pd.DataFrame:
    return grouped_distinct_by_category(df, "jenis_sanksi", "jenis_sanksi", 8)

def repeat_offenders(df: pd.DataFrame, limit: int = 10, min_count: int = 2) -> pd.DataFrame:
    columns = ["perner_karyawan", "nama_karyawan", "jumlah", "jabatan", "departemen", "jenis_sanksi"]
    if df.empty:
        return pd.DataFrame(columns=columns)
    prepared = df.copy()
    prepared["nama_label"] = prepared["nama_karyawan"].fillna(prepared["perner_karyawan"])
    for optional_column in ["jabatan_karyawan", "departemen_seksi", "jenis_sanksi"]:
        if optional_column not in prepared.columns:
            prepared[optional_column] = ""

    def join_unique(series: pd.Series) -> str:
        values = [str(value) for value in series.dropna().unique() if str(value).strip()]
        return ", ".join(values[:4]) + (" ..." if len(values) > 4 else "")

    grouped = (
        prepared.groupby(["perner_karyawan", "nama_label"], dropna=False)
        .agg(
            jumlah=("nomor_surat_sanksi", "nunique"),
            jabatan=("jabatan_karyawan", join_unique),
            departemen=("departemen_seksi", join_unique),
            jenis_sanksi=("jenis_sanksi", join_unique),
        )
        .reset_index()
        .sort_values("jumlah", ascending=False)
        .rename(columns={"nama_label": "nama_karyawan"})
    )
    grouped = grouped[grouped["jumlah"] >= min_count].head(limit)
    return grouped[columns]




VIOLATION_KEYWORDS = {
    "Etika Kerja": [
        "etika", "etik", "attitude", "perilaku", "sikap", "komunikasi", "tidak sopan",
        "menghina", "ancam", "berkelahi", "asusila", "pelecehan", "integritas", "kejujuran",
    ],
    "Kelalaian": [
        "lalai", "kelalaian", "ceroboh", "teledor", "negligence", "kerusakan", "hilang",
        "kehilangan", "tidak teliti", "salah input", "lupa", "meninggalkan", "tertinggal",
    ],
    "BCOC": [
        "bcoc", "business code of conduct", "code of conduct", "benturan kepentingan",
        "conflict of interest", "gratifikasi", "suap", "fraud", "pencurian", "pemalsuan",
    ],
    "Low Performance": [
        "low performance", "performance", "kinerja", "target", "produktifitas", "produktivitas",
        "tidak mencapai", "tidak memenuhi", "pencapaian", "output", "hasil kerja",
    ],
    "Kedisiplinan": [
        "disiplin", "kedisiplinan", "kedisplinan", "terlambat", "absen", "mangkir", "alpha", "alpa",
        "bolos", "hadir", "kehadiran", "jam kerja", "shift", "izin", "cuti", "indisipliner",
    ],
    "SOP / IOM / BN": [
        "sop", "iom", "bn", "berita negara", "prosedur", "instruksi kerja", "work instruction", "wi", "ketentuan kerja",
        "aturan kerja", "tidak sesuai prosedur", "melanggar prosedur", "standar kerja",
    ],
    "Temuan IAD": [
        "temuan", "audit", "ad", "iad", "i-ad", "internal audit department", "audit discovery", "finding", "internal audit", "external audit",
        "pemeriksaan", "inspeksi", "investigasi", "non conformity", "ncr",
    ],
}

def sanctions_per_year(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "tahun_sanksi" not in df.columns:
        return pd.DataFrame(columns=["tahun_sanksi", "jumlah"])
    return (
        df.groupby("tahun_sanksi")["nomor_surat_sanksi"]
        .nunique()
        .reset_index(name="jumlah")
        .sort_values("tahun_sanksi")
    )


def sanctions_by_status(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "status_sanksi" not in df.columns:
        return pd.DataFrame(columns=["status_sanksi", "jumlah"])
    order = ["Belum Dimulai", "Aktif", "Berakhir"]
    grouped = df.groupby("status_sanksi")["nomor_surat_sanksi"].nunique().reset_index(name="jumlah")
    base = pd.DataFrame({"status_sanksi": order})
    result = base.merge(grouped, on="status_sanksi", how="left")
    result["jumlah"] = result["jumlah"].fillna(0).astype(int)
    return result


def categorize_violation(value: object) -> str:
    if pd.isna(value) or not str(value).strip():
        return "Temuan IAD"
    text = f" {str(value).lower()} "
    for category, keywords in VIOLATION_KEYWORDS.items():
        for keyword in keywords:
            if keyword == "bn":
                if re.search(r"\bbn\b", text):
                    return category
                continue
            if keyword in {"ad", "iad", "i-ad"}:
                if re.search(r"\bi-?ad\b|\bad\b", text):
                    return category
                continue
            if keyword in text:
                return category
    return "Temuan IAD"


def violations_by_category(df: pd.DataFrame, limit: int = 7) -> pd.DataFrame:
    categories = list(VIOLATION_KEYWORDS.keys())
    base = pd.DataFrame({"uraian_pelanggaran": categories})
    if df.empty or "uraian_pelanggaran" not in df.columns:
        base["jumlah"] = 0
        return base.head(limit)

    prepared = df.copy()
    prepared = prepared[prepared["nomor_surat_sanksi"].notna()]
    prepared["uraian_pelanggaran"] = prepared["uraian_pelanggaran"].apply(categorize_violation)
    prepared["nomor_surat_sanksi"] = prepared["nomor_surat_sanksi"].astype(str).str.strip()
    prepared = prepared[prepared["nomor_surat_sanksi"] != ""]
    prepared = prepared.drop_duplicates(subset=["nomor_surat_sanksi"], keep="first")
    if prepared.empty:
        base["jumlah"] = 0
        return base.head(limit)

    grouped = (
        prepared.groupby("uraian_pelanggaran")["nomor_surat_sanksi"]
        .nunique()
        .reset_index(name="jumlah")
    )
    result = base.merge(grouped, on="uraian_pelanggaran", how="left")
    result["jumlah"] = result["jumlah"].fillna(0).astype(int)
    result["_order"] = result["uraian_pelanggaran"].apply(lambda value: categories.index(value))
    return result.sort_values(["jumlah", "_order"], ascending=[False, True]).drop(columns=["_order"]).head(limit)
def average_duration(df: pd.DataFrame) -> float:
    if df.empty:
        return 0.0

    prepared = df.copy()
    if "nomor_surat_sanksi" in prepared.columns:
        prepared["nomor_surat_sanksi"] = prepared["nomor_surat_sanksi"].astype(str).str.strip()
        prepared = prepared[prepared["nomor_surat_sanksi"] != ""]
        prepared = prepared.drop_duplicates(subset=["nomor_surat_sanksi"], keep="first")

    duration = pd.Series(pd.NA, index=prepared.index, dtype="Float64")
    if "durasi_sanksi_hari" in prepared.columns:
        duration = pd.to_numeric(prepared["durasi_sanksi_hari"], errors="coerce").astype("Float64")

    if {"tanggal_mulai_sanksi", "tanggal_berakhir_sanksi"}.issubset(prepared.columns):
        start = pd.to_datetime(prepared["tanggal_mulai_sanksi"], errors="coerce")
        end = pd.to_datetime(prepared["tanggal_berakhir_sanksi"], errors="coerce")
        calculated = ((end - start).dt.days + 1).astype("Float64")
        duration = duration.fillna(calculated)

    duration = duration[duration >= 0].dropna()
    mean_value = duration.mean()
    return 0.0 if pd.isna(mean_value) else float(mean_value)

def dashboard_summary(df: pd.DataFrame) -> dict[str, object]:
    offenders = repeat_offenders(df)
    display_offenders = offenders if not offenders.empty else repeat_offenders(df, min_count=1)
    return {
        "total_sanksi": distinct_count(df),
        "total_karyawan": int(df["perner_karyawan"].dropna().astype(str).nunique()) if "perner_karyawan" in df.columns and not df.empty else 0,
        "total_aktif": distinct_count(df[df["status_sanksi"] == "Aktif"]) if "status_sanksi" in df.columns else 0,
        "total_departemen": int(df["departemen_seksi"].dropna().nunique()) if "departemen_seksi" in df.columns and not df.empty else 0,
        "total_pelanggar_berulang": len(offenders),
        "rata_durasi": average_duration(df),
        "bulanan": sanctions_per_month(df),
        "tahunan": sanctions_per_year(df),
        "departemen": sanctions_by_department(df, limit = 10),
        "jenis": sanctions_by_type(df),
        "status": sanctions_by_status(df),
        "kategori_pelanggaran": violations_by_category(df),
        "pelanggar_berulang": display_offenders,
    }


def count_by_column(df: pd.DataFrame, column: str) -> pd.DataFrame:
    if column not in df.columns:
        return pd.DataFrame(columns=[column, "jumlah"])
    return df.groupby(column, dropna=False)["nomor_surat_sanksi"].nunique().reset_index(name="jumlah")





