from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Sanction:
    nama: str
    nik: str
    departemen: str
    jenis_sanksi: str
    tanggal: date
    keterangan: str = ""
